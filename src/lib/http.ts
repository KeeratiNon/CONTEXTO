import { GameError } from "@/lib/types";

export function jsonError(error: unknown) {
  if (error instanceof GameError) {
    return Response.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }
  console.error(error);
  return Response.json(
    { error: "server_error", message: "Something went wrong." },
    { status: 500 },
  );
}

export async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}
