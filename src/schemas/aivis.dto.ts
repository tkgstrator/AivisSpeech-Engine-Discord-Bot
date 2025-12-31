import { z } from 'zod'

/**
 * モーラ情報
 */
export const MoraSchema = z.object({
  text: z.string(),
  consonant: z.string().nullable().optional(),
  consonant_length: z.number().nullable().optional(),
  vowel: z.string(),
  vowel_length: z.number(),
  pitch: z.number(),
})

/**
 * アクセント句情報
 */
export const AccentPhraseSchema = z.object({
  moras: z.array(MoraSchema),
  accent: z.number(),
  pause_mora: MoraSchema.nullable().optional(),
  is_interrogative: z.boolean().optional(),
})

/**
 * 音声合成クエリ
 */
export const AudioQuerySchema = z.object({
  accent_phrases: z.array(AccentPhraseSchema),
  speedScale: z.number(),
  intonationScale: z.number(),
  tempoDynamicsScale: z.number().optional(),
  pitchScale: z.number(),
  volumeScale: z.number(),
  prePhonemeLength: z.number(),
  postPhonemeLength: z.number(),
  pauseLength: z.number().nullable().optional(),
  pauseLengthScale: z.number().optional(),
  outputSamplingRate: z.number(),
  outputStereo: z.boolean(),
  kana: z.string().optional(),
})

/**
 * スピーカースタイル情報
 */
export const SpeakerStyleSchema = z.object({
  name: z.string(),
  id: z.number(),
  type: z.enum(['talk', 'singing_teacher', 'frame_decode', 'sing']).optional(),
})

/**
 * スピーカー対応機能
 */
export const SpeakerSupportedFeaturesSchema = z.object({
  permitted_synthesis_morphing: z.enum(['ALL', 'SELF_ONLY', 'NOTHING']).optional(),
})

/**
 * スピーカー情報
 */
export const SpeakerSchema = z.object({
  name: z.string(),
  speaker_uuid: z.string(),
  styles: z.array(SpeakerStyleSchema),
  version: z.string().optional(),
  supported_features: SpeakerSupportedFeaturesSchema.optional(),
})

/**
 * スピーカー一覧
 */
export const SpeakersResponseSchema = z.array(SpeakerSchema)

/**
 * HTTPバリデーションエラー
 */
export const ValidationErrorSchema = z.object({
  loc: z.array(z.union([z.string(), z.number()])),
  msg: z.string(),
  type: z.string(),
})

export const HTTPValidationErrorSchema = z.object({
  detail: z.array(ValidationErrorSchema).optional(),
})

/**
 * 単語の品詞
 */
export const WordTypesSchema = z.enum([
  'PROPER_NOUN',
  'LOCATION_NAME',
  'ORGANIZATION_NAME',
  'PERSON_NAME',
  'PERSON_FAMILY_NAME',
  'PERSON_GIVEN_NAME',
  'COMMON_NOUN',
  'VERB',
  'ADJECTIVE',
  'SUFFIX',
])

/**
 * ユーザー辞書の単語情報
 */
export const UserDictWordSchema = z.object({
  surface: z.string(),
  priority: z.number().int().min(0).max(10),
  context_id: z.number().int().optional(),
  part_of_speech: z.string(),
  part_of_speech_detail_1: z.string(),
  part_of_speech_detail_2: z.string(),
  part_of_speech_detail_3: z.string(),
  word_type: WordTypesSchema.optional(),
  inflectional_type: z.string(),
  inflectional_form: z.string(),
  stem: z.array(z.string()),
  yomi: z.array(z.string()),
  pronunciation: z.array(z.string()),
  accent_type: z.array(z.number().int()),
  mora_count: z.array(z.number().int()).optional(),
  accent_associative_rule: z.string(),
})

/**
 * ユーザー辞書レスポンス（UUIDをキーとした辞書）
 */
export const UserDictResponseSchema = z.record(z.string(), UserDictWordSchema)

// 型エクスポート
export type Mora = z.infer<typeof MoraSchema>
export type AccentPhrase = z.infer<typeof AccentPhraseSchema>
export type AudioQuery = z.infer<typeof AudioQuerySchema>
export type SpeakerStyle = z.infer<typeof SpeakerStyleSchema>
export type Speaker = z.infer<typeof SpeakerSchema>
export type WordTypes = z.infer<typeof WordTypesSchema>
export type UserDictWord = z.infer<typeof UserDictWordSchema>
