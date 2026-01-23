import { describe, expect, test } from 'bun:test'
import { SpeakerConfigSchema, SpeakerConfigUpdateSchema, UserSettingsSchema } from '../src/schemas/userSettings.dto'

describe('SpeakerConfigSchema', () => {
  test('正常な値でバリデーションが成功する', () => {
    const validData = {
      speedScale: 1.0,
      pitchScale: 0.0,
      volumeScale: 1.0,
      intonationScale: 1.0
    }
    const result = SpeakerConfigSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  test('デフォルト値が適用される', () => {
    const result = SpeakerConfigSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.speedScale).toBe(1.0)
      expect(result.data.pitchScale).toBe(0.0)
      expect(result.data.volumeScale).toBe(1.0)
      expect(result.data.intonationScale).toBe(1.0)
    }
  })

  test('speedScaleが範囲外の場合はバリデーションエラー', () => {
    const invalidData = {
      speedScale: 0.3, // 0.5未満
      pitchScale: 0.0,
      volumeScale: 1.0,
      intonationScale: 1.0
    }
    const result = SpeakerConfigSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })

  test('speedScaleが最大値を超える場合はバリデーションエラー', () => {
    const invalidData = {
      speedScale: 2.5, // 2.0超過
      pitchScale: 0.0,
      volumeScale: 1.0,
      intonationScale: 1.0
    }
    const result = SpeakerConfigSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })

  test('pitchScaleが範囲外の場合はバリデーションエラー', () => {
    const invalidData = {
      speedScale: 1.0,
      pitchScale: 0.2, // 0.15超過
      volumeScale: 1.0,
      intonationScale: 1.0
    }
    const result = SpeakerConfigSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })

  test('volumeScaleが範囲外の場合はバリデーションエラー', () => {
    const invalidData = {
      speedScale: 1.0,
      pitchScale: 0.0,
      volumeScale: -0.1, // 0.0未満
      intonationScale: 1.0
    }
    const result = SpeakerConfigSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })

  test('intonationScaleが範囲外の場合はバリデーションエラー', () => {
    const invalidData = {
      speedScale: 1.0,
      pitchScale: 0.0,
      volumeScale: 1.0,
      intonationScale: 2.5 // 2.0超過
    }
    const result = SpeakerConfigSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })
})

describe('SpeakerConfigUpdateSchema', () => {
  test('部分的な更新が可能', () => {
    const partialData = {
      speedScale: 1.5
    }
    const result = SpeakerConfigUpdateSchema.safeParse(partialData)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.speedScale).toBe(1.5)
      // partial()はデフォルト値も適用されるため、他のフィールドもデフォルト値になる
      expect(result.data.pitchScale).toBe(0.0)
      expect(result.data.volumeScale).toBe(1.0)
      expect(result.data.intonationScale).toBe(1.0)
    }
  })

  test('空のオブジェクトも許可', () => {
    const result = SpeakerConfigUpdateSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  test('範囲外の値は拒否', () => {
    const invalidData = {
      speedScale: 3.0 // 2.0超過
    }
    const result = SpeakerConfigUpdateSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })
})

describe('UserSettingsSchema', () => {
  test('正常な値でバリデーションが成功する', () => {
    const validData = {
      currentSpeakerId: 123,
      speakerSettings: {
        '123': {
          speedScale: 1.2,
          pitchScale: 0.05,
          volumeScale: 1.0,
          intonationScale: 1.0
        }
      }
    }
    const result = UserSettingsSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  test('speakerSettingsのデフォルト値が適用される', () => {
    const minimalData = {
      currentSpeakerId: 456
    }
    const result = UserSettingsSchema.safeParse(minimalData)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.speakerSettings).toEqual({})
    }
  })

  test('currentSpeakerIdが整数でない場合はバリデーションエラー', () => {
    const invalidData = {
      currentSpeakerId: 123.45,
      speakerSettings: {}
    }
    const result = UserSettingsSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })

  test('currentSpeakerIdが負の値の場合はバリデーションエラー', () => {
    const invalidData = {
      currentSpeakerId: -1,
      speakerSettings: {}
    }
    const result = UserSettingsSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })

  test('currentSpeakerIdが0の場合はバリデーションエラー', () => {
    const invalidData = {
      currentSpeakerId: 0,
      speakerSettings: {}
    }
    const result = UserSettingsSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })

  test('speakerSettingsのキーが数字以外の場合はバリデーションエラー', () => {
    const invalidData = {
      currentSpeakerId: 123,
      speakerSettings: {
        'invalid-key': {
          speedScale: 1.0,
          pitchScale: 0.0,
          volumeScale: 1.0,
          intonationScale: 1.0
        }
      }
    }
    const result = UserSettingsSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })

  test('複数の話者設定が可能', () => {
    const validData = {
      currentSpeakerId: 123,
      speakerSettings: {
        '123': {
          speedScale: 1.2,
          pitchScale: 0.05,
          volumeScale: 1.0,
          intonationScale: 1.0
        },
        '456': {
          speedScale: 0.8,
          pitchScale: -0.1,
          volumeScale: 1.5,
          intonationScale: 0.9
        }
      }
    }
    const result = UserSettingsSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })
})
