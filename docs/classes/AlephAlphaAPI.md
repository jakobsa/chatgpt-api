[chatgpt](../readme.md) / [Exports](../modules.md) / AlephAlphaAPI

# Class: AlephAlphaAPI

## Table of contents

### Constructors

- [constructor](AlephAlphaAPI.md#constructor)

### Accessors

- [apiKey](AlephAlphaAPI.md#apikey)

### Methods

- [sendMessage](AlephAlphaAPI.md#sendmessage)

## Constructors

### constructor

• **new AlephAlphaAPI**(`opts`)

Creates a new client wrapper around AlephAlpha's completion API using the
unofficial AlephAlpha model.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `opts` | `Object` | - |
| `opts.apiBaseUrl?` | `string` | **`Default Value`** `'https://api.aleph-alpha.com'` * |
| `opts.apiKey` | `string` | - |
| `opts.apiReverseProxyUrl?` | `string` | **`Default Value`** `undefined` * |
| `opts.assistantLabel?` | `string` | **`Default Value`** `'GPT'` * |
| `opts.completionParams?` | `Partial`<[`CompletionParams`](../modules/alephAlpha.md#completionparams)\> | - |
| `opts.debug?` | `boolean` | **`Default Value`** `false` * |
| `opts.fetch?` | (`input`: `RequestInfo` \| `URL`, `init?`: `RequestInit`) => `Promise`<`Response`\> | - |
| `opts.getMessageById?` | [`GetMessageByIdFunction`](../modules.md#getmessagebyidfunction) | - |
| `opts.maxModelTokens?` | `number` | **`Default Value`** `4096` * |
| `opts.maxResponseTokens?` | `number` | **`Default Value`** `1000` * |
| `opts.messageStore?` | `Keyv`<`any`, `Record`<`string`, `unknown`\>\> | - |
| `opts.upsertMessage?` | [`UpsertMessageFunction`](../modules.md#upsertmessagefunction) | - |
| `opts.userLabel?` | `string` | **`Default Value`** `'User'` * |

#### Defined in

[src/aleph-alpha-api.ts:52](https://github.com/jakobsa/chatgpt-api/blob/2bf8926/src/aleph-alpha-api.ts#L52)

## Accessors

### apiKey

• `get` **apiKey**(): `string`

#### Returns

`string`

#### Defined in

[src/aleph-alpha-api.ts:311](https://github.com/jakobsa/chatgpt-api/blob/2bf8926/src/aleph-alpha-api.ts#L311)

• `set` **apiKey**(`apiKey`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `apiKey` | `string` |

#### Returns

`void`

#### Defined in

[src/aleph-alpha-api.ts:315](https://github.com/jakobsa/chatgpt-api/blob/2bf8926/src/aleph-alpha-api.ts#L315)

## Methods

### sendMessage

▸ **sendMessage**(`text`, `opts?`): `Promise`<[`ChatMessage`](../interfaces/ChatMessage.md)\>

Sends a message to AlephAlpha, waits for the response to resolve, and returns
the response.

If you want your response to have historical context, you must provide a valid `parentMessageId`.

If you want to receive the full response, including message and conversation IDs,
you can use `opts.onConversationResponse` or use the `AlephAlphaAPI.getConversation`
helper.

Set `debug: true` in the `AlephAlphaAPI` constructor to log more info on the full prompt sent to the AlephAlpha completions API. You can override the `promptPrefix` and `promptSuffix` in `opts` to customize the prompt.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `text` | `string` | The prompt message to send |
| `opts` | [`SendMessageOptionsMQ`](../modules.md#sendmessageoptionsmq) | - |

#### Returns

`Promise`<[`ChatMessage`](../interfaces/ChatMessage.md)\>

The response from AlephAlpha

#### Defined in

[src/aleph-alpha-api.ts:174](https://github.com/jakobsa/chatgpt-api/blob/2bf8926/src/aleph-alpha-api.ts#L174)
