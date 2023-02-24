[chatgpt](../readme.md) / [Exports](../modules.md) / alephAlpha

# Namespace: alephAlpha

## Table of contents

### Type Aliases

- [CompletionParams](alephAlpha.md#completionparams)
- [CompletionResponse](alephAlpha.md#completionresponse)
- [CompletionResponseCompletions](alephAlpha.md#completionresponsecompletions)

## Type Aliases

### CompletionParams

Ƭ **CompletionParams**: [`CompletionParamsGeneric`](../modules.md#completionparamsgeneric) & { `log_probs?`: `number` ; `maximum_tokens?`: `number` ; `stop_sequences?`: `string`[]  }

#### Defined in

[src/types.ts:187](https://github.com/jakobsa/chatgpt-api/blob/2bf8926/src/types.ts#L187)

___

### CompletionResponse

Ƭ **CompletionResponse**: [`CompletionResponseGeneric`](../modules.md#completionresponsegeneric) & { `completions`: [`CompletionResponseCompletions`](alephAlpha.md#completionresponsecompletions)[]  }

#### Defined in

[src/types.ts:204](https://github.com/jakobsa/chatgpt-api/blob/2bf8926/src/types.ts#L204)

___

### CompletionResponseCompletions

Ƭ **CompletionResponseCompletions**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `completion?` | `string` |
| `finish_reason?` | `string` |
| `raw_completion?` | `string` |

#### Defined in

[src/types.ts:207](https://github.com/jakobsa/chatgpt-api/blob/2bf8926/src/types.ts#L207)
