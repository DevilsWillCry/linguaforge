/** What the Video Lab needs from a player, so YouTube and local files work the same way. */
export interface MediaPlayer {
  play(): void
  pause(): void
  seek(seconds: number): void
  time(): number
  isPlaying(): boolean
  setRate(rate: number): void
  title(): string | undefined
  destroy(): void
}

/** Local files. Browsers keep the pitch when the speed changes, as long as it stays on. */
export function createHtmlPlayer(element: HTMLMediaElement): MediaPlayer {
  element.preservesPitch = true
  return {
    play: () => void element.play().catch(() => {}),
    pause: () => element.pause(),
    seek: (seconds) => {
      element.currentTime = seconds
    },
    time: () => element.currentTime,
    isPlaying: () => !element.paused && !element.ended,
    setRate: (rate) => {
      element.playbackRate = rate
    },
    title: () => undefined,
    destroy: () => element.pause(),
  }
}

/** The parts of YouTube's IFrame Player API used here. */
interface YouTubePlayer {
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getPlayerState(): number
  setPlaybackRate(rate: number): void
  getVideoData(): { title?: string }
  destroy(): void
}

interface YouTubeApi {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string
      host?: string
      playerVars?: Record<string, number | string>
      events?: { onReady?: () => void; onError?: () => void }
    },
  ) => YouTubePlayer
  PlayerState: { PLAYING: number }
}

declare global {
  interface Window {
    YT?: YouTubeApi
    onYouTubeIframeAPIReady?: () => void
  }
}

const API_TIMEOUT_MS = 15_000
let apiLoading: Promise<YouTubeApi> | null = null

/** YouTube's official player script. It's loaded once, and only when a video is opened. */
function loadYouTubeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  apiLoading ??= new Promise<YouTubeApi>((resolve, reject) => {
    const fail = () => {
      // A later attempt can try again, for example once the connection is back.
      apiLoading = null
      reject(new Error('The YouTube player could not be loaded'))
    }
    const timer = setTimeout(fail, API_TIMEOUT_MS)
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer)
      resolve(window.YT!)
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.onerror = () => {
      clearTimeout(timer)
      fail()
    }
    document.head.append(script)
  })
  return apiLoading
}

/** Embeds the video with the official player. The video is never downloaded or stored. */
export async function createYouTubePlayer(element: HTMLElement, videoId: string, startSec: number): Promise<MediaPlayer> {
  const api = await loadYouTubeApi()
  return new Promise((resolve, reject) => {
    const player = new api.Player(element, {
      videoId,
      host: 'https://www.youtube-nocookie.com',
      // Asks for no captions, because they'd show the answers in practice. YouTube can still
      // turn them on from the viewer's own preferences, so practice mode reminds them.
      playerVars: { playsinline: 1, rel: 0, cc_load_policy: 0, start: Math.floor(startSec) },
      events: {
        onError: () => reject(new Error('The video could not be played')),
        onReady: () =>
          resolve({
            play: () => player.playVideo(),
            pause: () => player.pauseVideo(),
            seek: (seconds) => player.seekTo(seconds, true),
            time: () => player.getCurrentTime() ?? 0,
            isPlaying: () => player.getPlayerState() === api.PlayerState.PLAYING,
            setRate: (rate) => player.setPlaybackRate(rate),
            title: () => player.getVideoData().title || undefined,
            destroy: () => player.destroy(),
          }),
      },
    })
  })
}
