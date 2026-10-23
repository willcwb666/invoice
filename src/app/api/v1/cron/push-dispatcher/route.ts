import { NextRequest } from "next/server";
import { GET as dispatcherGet, POST as dispatcherPost } from "../dispatcher/route";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return dispatcherGet(req);
}

export async function POST(req: NextRequest) {
  return dispatcherPost(req);
}
