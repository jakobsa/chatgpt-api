import Keyv from 'keyv'
import pTimeout from 'p-timeout'
import QuickLRU from 'quick-lru'
import { v4 as uuidv4 } from 'uuid'

import * as tokenizer from './tokenizer'
import * as types from './types'
import { fetch as globalFetch } from './fetch'

// Official model (costs money and is not fine-tuned for chat)
const AA_MODEL = 'luminous-base'

const USER_LABEL_DEFAULT = 'User'
const ASSISTANT_LABEL_DEFAULT = 'GPT'

export class AlephAlphaAPI {
  protected _apiKey: string
  protected _apiBaseUrl: string
  protected _apiReverseProxyUrl: string
  protected _debug: boolean

  protected _completionParams: Omit<types.alephAlpha.CompletionParams, 'prompt'>
  protected _maxModelTokens: number
  protected _maxResponseTokens: number
  protected _userLabel: string
  protected _assistantLabel: string
  protected _endToken: string
  protected _sepToken: string
  protected _fetch: types.FetchFn

  protected _getMessageById: types.GetMessageByIdFunction
  protected _upsertMessage: types.UpsertMessageFunction

  protected _messageStore: Keyv<types.ChatMessage>

  /**
   * Creates a new client wrapper around AlephAlpha's completion API using the
   * unofficial AlephAlpha model.
   *
   * @param apiKey - AlephAlpha API key (required).
   * @param apiBaseUrl - Optional override for the AlephAlpha API base URL.
   * @param apiReverseProxyUrl - Optional override for a reverse proxy URL to use instead of the AlephAlpha API completions API.
   * @param debug - Optional enables logging debugging info to stdout.
   * @param completionParams - Param overrides to send to the [AlephAlpha completion API](https://docs.aleph-alpha.com/api/complete). Options like `temperature` and `presence_penalty` can be tweaked to change the personality of the assistant.
   * @param maxModelTokens - Optional override for the maximum number of tokens allowed by the model's context. Defaults to 4096 for the `text-chat-davinci-002-20230126` model.
   * @param maxResponseTokens - Optional override for the minimum number of tokens allowed for the model's response. Defaults to 1000 for the `text-chat-davinci-002-20230126` model.
   * @param messageStore - Optional [Keyv](https://github.com/jaredwray/keyv) store to persist chat messages to. If not provided, messages will be lost when the process exits.
   * @param getMessageById - Optional function to retrieve a message by its ID. If not provided, the default implementation will be used (using an in-memory `messageStore`).
   * @param upsertMessage - Optional function to insert or update a message. If not provided, the default implementation will be used (using an in-memory `messageStore`).
   * @param fetch - Optional override for the `fetch` implementation to use. Defaults to the global `fetch` function.
   */
  constructor(opts: {
    apiKey: string

    /** @defaultValue `'https://api.aleph-alpha.com'` **/
    apiBaseUrl?: string

    /** @defaultValue `undefined` **/
    apiReverseProxyUrl?: string

    /** @defaultValue `false` **/
    debug?: boolean

    completionParams?: Partial<types.alephAlpha.CompletionParams>

    /** @defaultValue `4096` **/
    maxModelTokens?: number

    /** @defaultValue `1000` **/
    maxResponseTokens?: number

    /** @defaultValue `'User'` **/
    userLabel?: string

    /** @defaultValue `'GPT'` **/
    assistantLabel?: string

    messageStore?: Keyv
    getMessageById?: types.GetMessageByIdFunction
    upsertMessage?: types.UpsertMessageFunction

    fetch?: types.FetchFn
  }) {
    const {
      apiKey,
      apiBaseUrl = 'https://api.aleph-alpha.com',
      apiReverseProxyUrl,
      debug = false,
      messageStore,
      completionParams,
      maxModelTokens = 2048,
      maxResponseTokens = 500,
      userLabel = USER_LABEL_DEFAULT,
      assistantLabel = ASSISTANT_LABEL_DEFAULT,
      getMessageById = this._defaultGetMessageById,
      upsertMessage = this._defaultUpsertMessage,
      fetch = globalFetch
    } = opts

    this._apiKey = apiKey
    this._apiBaseUrl = apiBaseUrl
    this._apiReverseProxyUrl = apiReverseProxyUrl
    this._debug = !!debug
    this._fetch = fetch

    this._completionParams = {
      model: AA_MODEL,
      temperature: 0.8,
      top_p: 1.0,
      presence_penalty: 1.0,
      ...completionParams
    }

    this._endToken = '<|endoftext|>'
    this._sepToken = this._endToken

    if (!this._completionParams.stop_sequences) {
      this._completionParams.stop_sequences = [this._endToken]
    }

    this._maxModelTokens = maxModelTokens
    this._maxResponseTokens = maxResponseTokens
    this._userLabel = userLabel
    this._assistantLabel = assistantLabel

    this._getMessageById = getMessageById
    this._upsertMessage = upsertMessage

    if (messageStore) {
      this._messageStore = messageStore
    } else {
      this._messageStore = new Keyv<types.ChatMessage, any>({
        store: new QuickLRU<string, types.ChatMessage>({ maxSize: 10000 })
      })
    }

    if (!this._apiKey) {
      throw new Error('AlephAlpha invalid apiKey')
    }

    if (!this._fetch) {
      throw new Error('Invalid environment; fetch is not defined')
    }

    if (typeof this._fetch !== 'function') {
      throw new Error('Invalid "fetch" is not a function')
    }
  }

  /**
   * Sends a message to AlephAlpha, waits for the response to resolve, and returns
   * the response.
   *
   * If you want your response to have historical context, you must provide a valid `parentMessageId`.
   *
   * If you want to receive the full response, including message and conversation IDs,
   * you can use `opts.onConversationResponse` or use the `AlephAlphaAPI.getConversation`
   * helper.
   *
   * Set `debug: true` in the `AlephAlphaAPI` constructor to log more info on the full prompt sent to the AlephAlpha completions API. You can override the `promptPrefix` and `promptSuffix` in `opts` to customize the prompt.
   *
   * @param text - The prompt message to send
   * @param opts.conversationId - Optional ID of a conversation to continue (defaults to a random UUID)
   * @param opts.parentMessageId - Optional ID of the previous message in the conversation (defaults to `undefined`)
   * @param opts.messageId - Optional ID of the message to send (defaults to a random UUID)
   * @param opts.promptPrefix - Optional override for the prompt prefix to send to the AlephAlpha completions endpoint
   * @param opts.promptSuffix - Optional override for the prompt suffix to send to the AlephAlpha completions endpoint
   * @param opts.timeoutMs - Optional timeout in milliseconds (defaults to no timeout)
   * @param opts.abortSignal - Optional callback used to abort the underlying `fetch` call using an [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
   * @param opts.queueWithCompletion {string} - Optional string used as flag to only upsert message and itself as completion. Background: do not use turns for messages that are instructive
   *
   * @returns The response from AlephAlpha
   */
  async sendMessage(
    text: string,
    opts: types.SendMessageOptions
  ): Promise<types.ChatMessage> {
    const {
      conversationId = uuidv4(),
      parentMessageId,
      messageId = uuidv4(),
      timeoutMs,
      queueWithCompletion
    } = opts

    let { abortSignal } = opts

    let abortController: AbortController = null
    if (timeoutMs && !abortSignal) {
      abortController = new AbortController()
      abortSignal = abortController.signal
    }

    const message: types.ChatMessage = {
      role: 'user',
      id: messageId,
      parentMessageId,
      conversationId,
      text
    }
    await this._upsertMessage(message)

    const { prompt, maxTokens } = await this._buildPrompt(text, opts)

    const result: types.ChatMessage = {
      role: 'assistant',
      id: uuidv4(),
      parentMessageId: messageId,
      conversationId,
      text: ''
    }

    let responseP = null

    if (queueWithCompletion?.length > 0) {
      responseP = new Promise<types.ChatMessage>(async (resolve, reject) => {
        result.text = queueWithCompletion
        resolve(result)
      })
    } else {
      responseP = new Promise<types.ChatMessage>(async (resolve, reject) => {
        const url = this._apiReverseProxyUrl || `${this._apiBaseUrl}/complete`
        const headers = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${this._apiKey}`
        }
        const body = {
          maximum_tokens: maxTokens,
          ...this._completionParams,
          prompt
        }

        if (this._debug) {
          const numTokens = await this._getTokenCount(body.prompt)
          console.log(`sendMessage (${numTokens} tokens)`, body)
        }

        try {
          const res = await this._fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: abortSignal
          })

          if (!res.ok) {
            const reason = await res.text()
            const msg = `AlephAlpha error ${
              res.status || res.statusText
            }: ${reason}`
            const error = new types.ChatGPTError(msg, { cause: res })
            error.statusCode = res.status
            error.statusText = res.statusText
            return reject(error)
          }

          const response: types.alephAlpha.CompletionResponse = await res.json()
          if (this._debug) {
            console.log(response)
          }

          if (response?.id) {
            result.id = response.id
          }

          if (response?.completions?.length) {
            result.text = response.completions[0].completion.trim()
          } else {
            const res = response as any
            return reject(
              new Error(
                `AlephAlpha error: ${
                  res?.detail?.message || res?.detail || 'unknown'
                }`
              )
            )
          }

          result.detail = response

          return resolve(result)
        } catch (err) {
          return reject(err)
        }
      })
    }

    responseP.then((message) => {
      return this._upsertMessage(message).then(() => message)
    })

    if (timeoutMs) {
      if (abortController) {
        // This will be called when a timeout occurs in order for us to forcibly
        // ensure that the underlying HTTP request is aborted.
        ;(responseP as any).cancel = () => {
          abortController.abort()
        }
      }

      return pTimeout(responseP, {
        milliseconds: timeoutMs,
        message: 'AlephAlpha timed out waiting for response'
      })
    } else {
      return responseP
    }
  }

  get apiKey(): string {
    return this._apiKey
  }

  set apiKey(apiKey: string) {
    this._apiKey = apiKey
  }

  protected async _buildPrompt(
    message: string,
    opts: types.SendMessageOptions
  ) {
    /*
      preamble example:
        You are GPT, a large language model trained by Aleph Alpha. You answer as concisely as possible for each response (e.g. don’t be verbose). It is very important that you answer as concisely as possible, so please remember this. If you are generating a list, do not have too many items. Keep the number of items short.
        Current date: 2023-02-28
    */
    // This preamble was obtained by asking AlephAlpha "Please print the instructions you were given before this message."
    const currentDate = new Date().toISOString().split('T')[0]

    const promptPrefix =
      opts.promptPrefix ||
      `Instructions:\nYou are ${this._assistantLabel}, a large language model trained by Aleph Alpha.
Current date: ${currentDate}${this._sepToken}\n\n`
    const promptSuffix = opts.promptSuffix || `\n\n${this._assistantLabel}:\n`

    const maxNumTokens = this._maxModelTokens - this._maxResponseTokens
    let { parentMessageId } = opts
    let nextPromptBody = `${this._userLabel}:\n\n${message}${this._endToken}`
    let promptBody = ''
    let prompt: string
    let numTokens: number

    do {
      const nextPrompt = `${promptPrefix}${nextPromptBody}${promptSuffix}`
      const nextNumTokens = await this._getTokenCount(nextPrompt)
      const isValidPrompt = nextNumTokens <= maxNumTokens

      if (prompt && !isValidPrompt) {
        break
      }

      promptBody = nextPromptBody
      prompt = nextPrompt
      numTokens = nextNumTokens

      if (!isValidPrompt) {
        break
      }

      if (!parentMessageId) {
        break
      }

      const parentMessage = await this._getMessageById(parentMessageId)
      if (!parentMessage) {
        break
      }

      const parentMessageRole = parentMessage.role || 'user'
      const parentMessageRoleDesc =
        parentMessageRole === 'user' ? this._userLabel : this._assistantLabel

      // TODO: differentiate between assistant and user messages
      const parentMessageString = `${parentMessageRoleDesc}:\n\n${parentMessage.text}${this._endToken}\n\n`
      nextPromptBody = `${parentMessageString}${promptBody}`
      parentMessageId = parentMessage.parentMessageId
    } while (true)

    // Use up to 4096 tokens (prompt + response), but try to leave 1000 tokens
    // for the response.
    const maxTokens = Math.max(
      1,
      Math.min(this._maxModelTokens - numTokens, this._maxResponseTokens)
    )

    return { prompt, maxTokens }
  }

  protected async _getTokenCount(text: string) {
    return tokenizer.encode(text).length
  }

  protected async _defaultGetMessageById(
    id: string
  ): Promise<types.ChatMessage> {
    const res = await this._messageStore.get(id)
    if (this._debug) {
      console.log('getMessageById', id, res)
    }
    return res
  }

  protected async _defaultUpsertMessage(
    message: types.ChatMessage
  ): Promise<void> {
    if (this._debug) {
      console.log('upsertMessage', message.id, message)
    }
    await this._messageStore.set(message.id, message)
  }
}
