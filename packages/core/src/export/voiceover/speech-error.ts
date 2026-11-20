export class SpeechError extends Error {
  readonly status: number;
  readonly explained: boolean;

  constructor(message: string, status: number, explained: boolean) {
    super(message);
    this.name = 'SpeechError';
    this.status = status;
    this.explained = explained;
  }
}
