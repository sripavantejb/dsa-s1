/**
 * JSDoc typedefs for the LeetCode Streak Automation module. This project is
 * plain JavaScript (see jsconfig.json), so we document the domain shapes here
 * to get editor type-checking without changing the build toolchain.
 *
 * @module leetcode-automation/types
 */

/**
 * @typedef {'reminder' | 'playwright'} EngineName
 * @typedef {'random' | 'sequential' | 'specific'} Rotation
 * @typedef {'success' | 'failure' | 'reminder' | 'skipped'} RunResult
 * @typedef {'connected' | 'expired' | 'disconnected'} SessionStatus
 * @typedef {'manual' | 'scheduled'} RunTrigger
 */

/**
 * @typedef {Object} NotificationChannel
 * @property {boolean} enabled
 * @property {string} target
 */

/**
 * @typedef {Object} AutomationSettingsDTO
 * @property {boolean} enabled
 * @property {boolean} paused
 * @property {EngineName} engine
 * @property {string} submissionTime  HH:mm in the configured timezone
 * @property {string} timezone        IANA timezone id
 * @property {Rotation} rotation
 * @property {string | null} specificSolutionId
 * @property {boolean} retryFailed
 * @property {number} maxRetries
 * @property {number} manualStreak
 * @property {Object} notifications
 * @property {string | null} lastRunAt
 * @property {string | null} nextRunAt
 * @property {RunResult | null} lastRunResult
 */

/**
 * @typedef {Object} StoredSolutionDTO
 * @property {string} id
 * @property {string} problemName
 * @property {string} problemUrl
 * @property {string} language
 * @property {string} sourceCode
 * @property {string} difficulty
 * @property {string[]} tags
 * @property {boolean} favorite
 * @property {string} notes
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} SubmissionLogDTO
 * @property {string} id
 * @property {string | null} solutionId
 * @property {string} problemName
 * @property {EngineName} engine
 * @property {RunResult} result
 * @property {string | null} startTime
 * @property {string | null} endTime
 * @property {number} executionMs
 * @property {string} failureReason
 * @property {string} screenshot
 * @property {string} browserVersion
 * @property {number} retryCount
 * @property {RunTrigger} trigger
 * @property {string} createdAt
 */

/**
 * The result an {@link AutomationEngine} returns for a single run.
 * @typedef {Object} EngineRunResult
 * @property {RunResult} result
 * @property {string} [failureReason]
 * @property {string} [screenshot]
 * @property {string} [browserVersion]
 * @property {string} [message]
 */

/**
 * Context handed to an {@link AutomationEngine} for one run.
 * @typedef {Object} EngineRunContext
 * @property {{ username: string, displayName?: string }} user
 * @property {StoredSolutionDTO} solution
 * @property {AutomationSettingsDTO} settings
 * @property {() => Promise<Object|null>} loadSession  Decrypts and returns the storageState, or null.
 */

export {};
