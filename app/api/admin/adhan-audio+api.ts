import { handleAdhanAudioAdmin } from '../../../lib/server/adhanAudioAdmin';

export function GET(request: Request) { return handleAdhanAudioAdmin(request); }
export function POST(request: Request) { return handleAdhanAudioAdmin(request); }
