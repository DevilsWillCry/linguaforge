/** The messages between the page and the worker that runs the voice model. */
export type WorkerRequest =
  | { type: 'load' }
  | { type: 'speak'; id: number; text: string; voice: string; speed: number }
  | { type: 'cancel'; id: number }

export type WorkerReply =
  | { type: 'progress'; file: string; loaded: number; total: number }
  | { type: 'ready' }
  | { type: 'loadFailed' }
  | { type: 'chunk'; id: number; samples: Float32Array<ArrayBuffer>; sampleRate: number; chars: number }
  | { type: 'done'; id: number }
  | { type: 'speakFailed'; id: number }
