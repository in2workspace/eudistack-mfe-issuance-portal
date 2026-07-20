export enum CannotContinueReason {
  NotCorrelated = 'NOT_CORRELATED',
  ConfigAbsent = 'CONFIG_ABSENT',
  EntryPointInvalid = 'ENTRY_POINT_INVALID',
  EntryPointStartFailed = 'ENTRY_POINT_START_FAILED',
  EntryPointTimeout = 'ENTRY_POINT_TIMEOUT',
  Unknown = 'UNKNOWN',
}
