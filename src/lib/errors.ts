import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class AppError extends Error {
  code: string;
  status: number;
  userMessage: string;

  constructor(code: string, message: string, userMessage: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
    this.userMessage = userMessage;
  }
}

export const toErrorResponse = (error: unknown) => {
  console.error("[toErrorResponse]", error);
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          userMessage: error.userMessage,
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: error.message,
          userMessage: "Some fields are invalid. Please review your input and try again.",
          details: error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  const message = error instanceof Error ? error.message : "Unknown error";

  return NextResponse.json(
    {
      error: {
        code: "internal_error",
        message,
        userMessage: "Something went wrong. Please try again.",
      },
    },
    { status: 500 },
  );
};
