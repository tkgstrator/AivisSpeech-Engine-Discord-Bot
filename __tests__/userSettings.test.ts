import { describe, expect, test } from 'bun:test'
import { SpeakerConfigSchema, SpeakerConfigUpdateSchema, UserSettingsSchema } from '../src/schemas/userSettings.dto'

describe('SpeakerConfigSchema', () => {
  test('正常な値でバリデーションが成功する', () => {
    const validData = {
      speed: 1.0,
      pitch: 0.0,
      volume: 1.0,
      intonation: 1.0
    }
    const result = SpeakerConfigSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  test('デフォルト値が適用される', () => {
    const result = SpeakerConfigSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.speed).toBe(1.0)
      expect(result.data.pitch).toBe(0.0)
      expect(result.data.volume).toBe(1.0)
      expect(result.data.intonation).toBe(1.0)
    }
  })

  test('speedが範囲外の場合はバリデーションエラー', () => {
    const invalidData = {
      speed: 0.3, // 0.5未満
      pitch: 0.0,
      volume: 1.0,
      intonation: 1.0
    }
    const result = SpeakerConfigSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })

  test('speedが最大値を超える場合はバリデーションエラー', () => {
    const invalidData = {
      speed: 2.5, // 2.0超過
      pitch: 0.0,
      volume: 1.0,
      intonation: 1.0
    }
    const result = SpeakerConfigSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })

  test('pitchが範囲外の場合はバリデーションエラー', () => {
    const invalidData = {
      speed: 1.0,
      pitch: 0.2, // 0.15超過
      volume: 1.0,
      intonation: 1.0
    }
    const result = SpeakerConfigSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })

  test('volumeが範囲外の場合はバリデーションエラー', () => {
    const invalidData = {
      speed: 1.0,
      pitch: 0.0,
      volume: -0.1, // 0.0未満
      intonation: 1.0
    }
    const result = SpeakerConfigSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })

  test('intonationが範囲外の場合はバリデーションエラー', () => {
    const invalidData = {
      speed: 1.0,
      pitch: 0.0,
      volume: 1.0,
      intonation: 2.5 // 2.0超過
    }
    const result = SpeakerConfigSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })
})

describe('SpeakerConfigUpdateSchema', () => {
  test('部分的な更新が可能', () => {
    const partialData = {
      speed: 1.5
    }
    const result = SpeakerConfigUpdateSchema.safeParse(partialData)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.speed).toBe(1.5)
      // partial()はデフォルト値も適用されるため、他のフィールドもデフォルト値になる
      expect(result.data.pitch).toBe(0.0)
      expect(result.data.volume).toBe(1.0)
      expect(result.data.intonation).toBe(1.0)
    }
  })

  test('空のオブジェクトも許可', () => {
    const result = SpeakerConfigUpdateSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  test('範囲外の値は拒否', () => {
    const invalidData = {
      speed: 3.0 // 2.0超過
    }
    const result = SpeakerConfigUpdateSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })
})

describe('UserSettingsSchema', () => {
  test('正常な値でバリデーションが成功する', () => {
    const validData = {
      speaker: {
        currentId: 123,
        settings: {
          123: {
            speed: 1.2,
            pitch: 0.05,
            volume: 1.0,
            intonation: 1.0
          }
        }
      }
    }
    const result = UserSettingsSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  test('speaker.settingsのデフォルト値が適用される', () => {
    const minimalData = {
      speaker: {
        currentId: 456
      }
    }
    const result = UserSettingsSchema.safeParse(minimalData)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.speaker.settings).toEqual({})
    }
  })

  test('currentIdが整数でない場合はバリデーションエラー', () => {
    const invalidData = {
      speaker: {
        currentId: 123.45,
        settings: {}
      }
    }
    const result = UserSettingsSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })

  test('currentIdが負の値の場合はバリデーションエラー', () => {
    const invalidData = {
      speaker: {
        currentId: -1,
        settings: {}
      }
    }
    const result = UserSettingsSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })

  test('currentIdが0の場合はバリデーションエラー', () => {
    const invalidData = {
      speaker: {
        currentId: 0,
        settings: {}
      }
    }
    const result = UserSettingsSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })

  test('複数の話者設定が可能', () => {
    const validData = {
      speaker: {
        currentId: 123,
        settings: {
          123: {
            speed: 1.2,
            pitch: 0.05,
            volume: 1.0,
            intonation: 1.0
          },
          456: {
            speed: 0.8,
            pitch: -0.1,
            volume: 1.5,
            intonation: 0.9
          }
        }
      }
    }
    const result = UserSettingsSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })
})
