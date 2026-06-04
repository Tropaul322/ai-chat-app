export const FREE_QUESTION_LIMIT_EXCEEDED_MESSAGE =
  "Limit exceeded. Please sign up or log in to continue."

export function getFreeQuestionLimitExceededMessage(limit?: number) {
  if (typeof limit !== "number") {
    return FREE_QUESTION_LIMIT_EXCEEDED_MESSAGE
  }

  return `Limit exceeded. Anonymous users can send up to ${limit} free messages. Please sign up or log in to continue.`
}

export class FreeQuestionLimitExceededError extends Error {
  constructor(limit?: number) {
    super(getFreeQuestionLimitExceededMessage(limit))
    this.name = "FreeQuestionLimitExceededError"
  }
}

export function isFreeQuestionLimitExceededError(
  error: unknown
): error is FreeQuestionLimitExceededError {
  return error instanceof FreeQuestionLimitExceededError
}
