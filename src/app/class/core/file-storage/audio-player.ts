import { AudioFile, AudioState } from './audio-file';
import { FileReaderUtil } from './file-reader-util';

export enum VolumeType {
  MASTER,
  AUDITION,
  SOUND_EFFECT,
  NOTICE
}

declare global {
  interface Window {
    AudioContext: typeof AudioContext;
    webkitAudioContext: typeof AudioContext;
  }
}

type AudioCache = { url: string, blob: Blob };

export class AudioPlayer {

  static readonly AUDITION_VOLUME_LOCAL_STORAGE_KEY = 'udonanaumu-audio-player-audition-volume-local-storage';
  static readonly MAIN_VOLUME_LOCAL_STORAGE_KEY = 'udonanaumu-audio-player-main-volume-local-storage';
  static readonly SOUND_EFFECT_VOLUME_LOCAL_STORAGE_KEY = 'udonanaumu-audio-player-sound-effect-volume-local-storage';
  static readonly NOTICE_VOLUME_LOCAL_STORAGE_KEY = 'udonanaumu-audio-player-notice-volume-local-storage';

  static readonly AUDITION_IS_MUTE_LOCAL_STORAGE_KEY = 'udonanaumu-audio-player-audition-is-mute-local-storage';
  static readonly MAIN_IS_MUTE_LOCAL_STORAGE_KEY = 'udonanaumu-audio-player-main-is-mute-local-storage';
  static readonly SOUND_EFFECT_IS_MUTE_LOCAL_STORAGE_KEY = 'udonanaumu-audio-player-sound-effect-is-mute-local-storage';
  static readonly NOTICE_IS_MUTE_LOCAL_STORAGE_KEY = 'udonanaumu-audio-player-notice-is-mute-local-storage';

  private static _audioContext: AudioContext
  static get audioContext(): AudioContext {
    if (!AudioPlayer._audioContext) AudioPlayer._audioContext = new (window.AudioContext || window.webkitAudioContext)();
    return AudioPlayer._audioContext;
  }

  private static _isMute: boolean = false;
  static get isMute(): boolean { return AudioPlayer._isMute; }
  static set isMute(isMute: boolean) {
    AudioPlayer._isMute = isMute;
    AudioPlayer.volume = AudioPlayer._volume;
  }

  private static _volume: number = 0.5;
  static get volume(): number { return AudioPlayer._volume; }
  static set volume(volume: number) {
    AudioPlayer._volume = volume;
    AudioPlayer.masterGainNode.gain.setTargetAtTime(AudioPlayer.isMute ? 0 : AudioPlayer._volume, AudioPlayer.audioContext.currentTime, 0.01);
  }

  private static _isAuditionMute: boolean = false;
  static get isAuditionMute(): boolean { return AudioPlayer._isAuditionMute; }
  static set isAuditionMute(isAuditionMute: boolean) {
    AudioPlayer._isAuditionMute = isAuditionMute;
    AudioPlayer.auditionVolume = AudioPlayer._auditionVolume;
  }

  private static _auditionVolume: number = 0.5;
  static get auditionVolume(): number { return AudioPlayer._auditionVolume; }
  static set auditionVolume(auditionVolume: number) {
    AudioPlayer._auditionVolume = auditionVolume;
    AudioPlayer.auditionGainNode.gain.setTargetAtTime(AudioPlayer.isAuditionMute ? 0 : AudioPlayer._auditionVolume, AudioPlayer.audioContext.currentTime, 0.01);
  }

  private static _isSoundEffectMute: boolean = false;
  static get isSoundEffectMute(): boolean { return AudioPlayer._isSoundEffectMute; }
  static set isSoundEffectMute(isSoundEffectMute: boolean) { 
    AudioPlayer._isSoundEffectMute = isSoundEffectMute; 
    AudioPlayer.soundEffectVolume = AudioPlayer._soundEffectVolume;
  }

  private static _soundEffectVolume: number = 0.5;
  static get soundEffectVolume(): number { return AudioPlayer._soundEffectVolume; }
  static set soundEffectVolume(soundEffectVolume: number) {
    AudioPlayer._soundEffectVolume = soundEffectVolume;
    AudioPlayer.soundEffectGainNode.gain.setTargetAtTime(AudioPlayer.isSoundEffectMute ? 0 : AudioPlayer._soundEffectVolume, AudioPlayer.audioContext.currentTime, 0.01);
  }

  private static _isNoticeMute: boolean = false;
  static get isNoticeMute(): boolean { return AudioPlayer._isNoticeMute; }
  static set isNoticeMute(isNoticeMute: boolean) { 
    AudioPlayer._isNoticeMute = isNoticeMute;
    AudioPlayer.noticeVolume = AudioPlayer._noticeVolume;
  }

  private static _noticeVolume: number = 0.5;
  static get noticeVolume(): number { return AudioPlayer._noticeVolume; }
  static set noticeVolume(noticeVolume: number) {
    AudioPlayer._noticeVolume = noticeVolume;
    AudioPlayer.noticeGainNode.gain.setTargetAtTime(AudioPlayer.isNoticeMute ? 0 : AudioPlayer._noticeVolume, AudioPlayer.audioContext.currentTime, 0.01);
  }

  private static _masterGainNode: GainNode
  private static get masterGainNode(): GainNode {
    if (!AudioPlayer._masterGainNode) {
      let masterGain = AudioPlayer.audioContext.createGain();
      masterGain.gain.setValueAtTime(AudioPlayer._volume, AudioPlayer.audioContext.currentTime);
      masterGain.connect(AudioPlayer.audioContext.destination);
      AudioPlayer._masterGainNode = masterGain;
    }
    return AudioPlayer._masterGainNode;
  }

  private static _auditionGainNode: GainNode
  private static get auditionGainNode(): GainNode {
    if (!AudioPlayer._auditionGainNode) {
      let auditionGain = AudioPlayer.audioContext.createGain();
      auditionGain.gain.setValueAtTime(AudioPlayer._auditionVolume, AudioPlayer.audioContext.currentTime);
      auditionGain.connect(AudioPlayer.audioContext.destination);
      AudioPlayer._auditionGainNode = auditionGain;
    }
    return AudioPlayer._auditionGainNode;
  }

  private static _soundEffectGainNode: GainNode
  private static get soundEffectGainNode(): GainNode {
    if (!AudioPlayer._soundEffectGainNode) {
      let soundEffectGain = AudioPlayer.audioContext.createGain();
      soundEffectGain.gain.setValueAtTime(AudioPlayer._soundEffectVolume, AudioPlayer.audioContext.currentTime);
      soundEffectGain.connect(AudioPlayer.audioContext.destination);
      AudioPlayer._soundEffectGainNode = soundEffectGain;
    }
    return AudioPlayer._soundEffectGainNode;
  }

  private static _noticeGainNode: GainNode
  private static get noticeGainNode(): GainNode {
    if (!AudioPlayer._noticeGainNode) {
      let noticeGain = AudioPlayer.audioContext.createGain();
      noticeGain.gain.setValueAtTime(AudioPlayer._noticeVolume, AudioPlayer.audioContext.currentTime);
      noticeGain.connect(AudioPlayer.audioContext.destination);
      AudioPlayer._noticeGainNode = noticeGain;
    }
    return AudioPlayer._noticeGainNode;
  }

  static get rootNode(): AudioNode { return AudioPlayer.masterGainNode; }
  static get auditionNode(): AudioNode { return AudioPlayer.auditionGainNode; }
  static get soundEffectNode(): AudioNode { return AudioPlayer.soundEffectGainNode; }
  static get noticeNode(): AudioNode { return AudioPlayer.noticeGainNode; }

  private _audioElm: HTMLAudioElement;
  private get audioElm(): HTMLAudioElement {
    if (!this._audioElm) {
      this._audioElm = new Audio();
      this._audioElm.onplay = () => { }
      this._audioElm.onpause = () => { this.mediaElementSource.disconnect(); }
      this._audioElm.onended = () => { this.mediaElementSource.disconnect(); }
    }
    return this._audioElm;
  }

  private _mediaElementSource: MediaElementAudioSourceNode;
  private get mediaElementSource(): MediaElementAudioSourceNode {
    if (!this._mediaElementSource) this._mediaElementSource = AudioPlayer.audioContext.createMediaElementSource(this.audioElm);
    return this._mediaElementSource;
  }

  audio: AudioFile;
  volumeType: VolumeType = VolumeType.MASTER;

  get volume(): number { return this.audioElm.volume; }
  set volume(volume) { this.audioElm.volume = volume; }
  get loop(): boolean { return this.audioElm.loop; }
  set loop(loop) { this.audioElm.loop = loop; }
  get paused(): boolean { return this.audioElm.paused; }

  private static cacheMap: Map<string, AudioCache> = new Map();

  constructor(audio?: AudioFile) {
    this.audio = audio;
  }

  static play(audio: AudioFile, volume: number = 1.0) {
    this.playBufferAsync(audio, volume);
  }

  static playSoundEffect(audio: AudioFile, volume: number = 1.0) {
    this.playBufferAsyncBase(AudioPlayer.soundEffectNode, audio, volume);
  }

  play(audio: AudioFile = this.audio) {
    this.stop();
    this.audio = audio;
    if (!this.audio) return;

    let url = this.audio.url;

    if (audio.state === AudioState.URL) {
      if (AudioPlayer.cacheMap.has(audio.identifier)) {
        url = AudioPlayer.cacheMap.get(audio.identifier).url;
      } else {
        AudioPlayer.createCacheAsync(audio);
      }
    }

    this.mediaElementSource.connect(this.getConnectingAudioNode());
    this.audioElm.src = url;
    this.audioElm.load();
    this.audioElm.play().catch(reason => { console.warn(reason); });
  }

  pause() {
    this.audioElm.pause();
  }

  stop() {
    if (!this.audioElm) return;
    this.pause();
    this.audioElm.currentTime = 0;
    this.audioElm.src = '';
    this.audioElm.load();
    this.mediaElementSource.disconnect();
  }

  private getConnectingAudioNode() {
    switch (this.volumeType) {
      case VolumeType.AUDITION:
        return AudioPlayer.auditionNode;
      case VolumeType.SOUND_EFFECT:
        return AudioPlayer.soundEffectNode;
      case VolumeType.NOTICE:
        return AudioPlayer.noticeNode;
      default:
        return AudioPlayer.rootNode;
    }
  }

  private static async playBufferAsync(audio: AudioFile, volume: number = 1.0) {
    AudioPlayer.playBufferAsyncBase(AudioPlayer.rootNode, audio, volume);
    /*
    let source = await AudioPlayer.createBufferSourceAsync(audio);
    if (!source) return;

    let gain = AudioPlayer.audioContext.createGain();
    gain.gain.setValueAtTime(volume, AudioPlayer.audioContext.currentTime);

    gain.connect(AudioPlayer.rootNode);
    source.connect(gain);

    source.onended = () => {
      source.stop();
      source.disconnect();
      gain.disconnect();
      source.buffer = null;
    };

    source.start();
    */
  }

  private static async playBufferAsyncBase(audioNode: AudioNode, audio: AudioFile, volume: number = 1.0) {
    let source = await AudioPlayer.createBufferSourceAsync(audio);
    if (!source) return;

    let gain = AudioPlayer.audioContext.createGain();
    gain.gain.setValueAtTime(volume, AudioPlayer.audioContext.currentTime);

    gain.connect(audioNode);
    source.connect(gain);

    source.onended = () => {
      source.stop();
      source.disconnect();
      gain.disconnect();
      source.buffer = null;
    };

    source.start();
  }

  private static async createBufferSourceAsync(audio: AudioFile): Promise<AudioBufferSourceNode> {
    if (!audio) return null;
    try {
      let blob = audio.blob;
      if (audio.state === AudioState.URL) {
        if (AudioPlayer.cacheMap.has(audio.identifier)) {
          blob = AudioPlayer.cacheMap.get(audio.identifier).blob;
        } else {
          let cache = await AudioPlayer.createCacheAsync(audio);
          blob = cache && cache.blob ? cache.blob : null;
        }
      }
      if (!blob) return null;
      let decodedData = await this.decodeAudioDataAsync(blob);
      let source = AudioPlayer.audioContext.createBufferSource();
      source.buffer = decodedData;
      return source;
    } catch (reason) {
      console.warn(reason);
      return null;
    }
  }

  private static decodeAudioDataAsync(blob: Blob): Promise<AudioBuffer> {
    return new Promise(async (resolve, reject) => {
      AudioPlayer.audioContext.decodeAudioData(
        await FileReaderUtil.readAsArrayBufferAsync(blob),
        decodedData => resolve(decodedData),
        error => reject(error));
    });
  }

  private static async getBlobAsync(audio: AudioFile): Promise<Blob> {
    if (audio.blob) return audio.blob;
    if (audio.url.length < 1) throw new Error('えっ なにそれ怖い');

    try {
      let response = await fetch(audio.url);
      if (!response.ok) throw new Error('Network response was not ok.');
      let blob = await response.blob();
      return blob;
    } catch (error) {
      console.warn('There has been a problem with your fetch operation: ', error.message);
      throw error;
    }
  }

  private static async createCacheAsync(audio: AudioFile): Promise<AudioCache> {
    let cache = { url: audio.url, blob: null };
    try {
      cache.blob = await AudioPlayer.getBlobAsync(audio);
    } catch (e) {
      console.error(e);
      return cache;
    }

    if (AudioPlayer.cacheMap.has(audio.identifier)) {
      return AudioPlayer.cacheMap.get(audio.identifier);
    }

    cache.url = URL.createObjectURL(cache.blob);
    AudioPlayer.cacheMap.set(audio.identifier, cache);
    return cache;
  }

  static resumeAudioContext() {
    AudioPlayer.audioContext.resume();
    let callback = () => {
      AudioPlayer.audioContext.resume();
      document.removeEventListener('touchstart', callback, true);
      document.removeEventListener('mousedown', callback, true);
      console.log('resumeAudioContext');
    }
    document.addEventListener('touchstart', callback, true);
    document.addEventListener('mousedown', callback, true);
  }
}
