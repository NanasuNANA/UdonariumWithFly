import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';

import { AudioFile } from '@udonarium/core/file-storage/audio-file';
import { AudioPlayer, VolumeType } from '@udonarium/core/file-storage/audio-player';
import { AudioStorage } from '@udonarium/core/file-storage/audio-storage';
import { FileArchiver } from '@udonarium/core/file-storage/file-archiver';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem } from '@udonarium/core/system';
import { Jukebox } from '@udonarium/Jukebox';
import { PresetSound } from '@udonarium/sound-effect';
import { ContextMenuAction, ContextMenuService } from 'service/context-menu.service';

import { ModalService } from 'service/modal.service';
import { PanelService } from 'service/panel.service';

import * as localForage from 'localforage';

@Component({
  selector: 'app-jukebox',
  templateUrl: './jukebox.component.html',
  styleUrls: ['./jukebox.component.css']
})
export class JukeboxComponent implements OnInit, OnDestroy {

  get isMute() { return AudioPlayer.isMute; }
  set isMute(isMute: boolean) {
    AudioPlayer.isMute = isMute;
    EventSystem.trigger('CHANGE_JUKEBOX_VOLUME', null);
    if (!isMute) {
      localForage.removeItem(AudioPlayer.MAIN_IS_MUTE_LOCAL_STORAGE_KEY).catch(e => console.log(e));
    } else {
      localForage.setItem(AudioPlayer.MAIN_IS_MUTE_LOCAL_STORAGE_KEY, isMute).catch(e => console.log(e));
    }
  }
  get volume(): number { return AudioPlayer.volume; }
  set volume(volume: number) {
    this.isMute = (volume == 0);
    AudioPlayer.volume = volume;
    EventSystem.trigger('CHANGE_JUKEBOX_VOLUME', null);
    if (AudioPlayer.volume == 0.5) {
      localForage.removeItem(AudioPlayer.MAIN_VOLUME_LOCAL_STORAGE_KEY).catch(e => console.log(e));
    } else {
      localForage.setItem(AudioPlayer.MAIN_VOLUME_LOCAL_STORAGE_KEY, volume).catch(e => console.log(e));
    }
  }

  get isAuditionMute() { return AudioPlayer.isAuditionMute; }
  set isAuditionMute(isAuditionMute: boolean) { 
    AudioPlayer.isAuditionMute = isAuditionMute;
    EventSystem.trigger('CHANGE_JUKEBOX_VOLUME', null);
    if (!isAuditionMute) {
      localForage.removeItem(AudioPlayer.AUDITION_IS_MUTE_LOCAL_STORAGE_KEY).catch(e => console.log(e));
    } else {
      localForage.setItem(AudioPlayer.AUDITION_IS_MUTE_LOCAL_STORAGE_KEY, isAuditionMute).catch(e => console.log(e));
    }
  }
  get auditionVolume(): number { return AudioPlayer.auditionVolume; }
  set auditionVolume(auditionVolume: number) {
    this.isAuditionMute = (auditionVolume == 0);
    AudioPlayer.auditionVolume = auditionVolume;
    EventSystem.trigger('CHANGE_JUKEBOX_VOLUME', null);
    if (AudioPlayer.auditionVolume == 0.5) {
      localForage.removeItem(AudioPlayer.AUDITION_VOLUME_LOCAL_STORAGE_KEY).catch(e => console.log(e));
    } else {
      localForage.setItem(AudioPlayer.AUDITION_VOLUME_LOCAL_STORAGE_KEY, auditionVolume).catch(e => console.log(e));
    }
  }

  get isSoundEffectMute() { return AudioPlayer.isSoundEffectMute; }
  set isSoundEffectMute(isSoundEffectMute: boolean) {
    AudioPlayer.isSoundEffectMute = isSoundEffectMute;
    if (!isSoundEffectMute) {
      localForage.removeItem(AudioPlayer.SOUND_EFFECT_IS_MUTE_LOCAL_STORAGE_KEY).catch(e => console.log(e));
    } else {
      localForage.setItem(AudioPlayer.SOUND_EFFECT_IS_MUTE_LOCAL_STORAGE_KEY, isSoundEffectMute).catch(e => console.log(e));
    }
  }
  get soundEffectVolume(): number { return AudioPlayer.soundEffectVolume; }
  set soundEffectVolume(soundEffectVolume: number) {
    this.isSoundEffectMute = (soundEffectVolume == 0);
    AudioPlayer.soundEffectVolume = soundEffectVolume;
    //EventSystem.trigger('CHANGE_JUKEBOX_VOLUME', null);
    if (AudioPlayer.soundEffectVolume == 0.5) {
      localForage.removeItem(AudioPlayer.SOUND_EFFECT_VOLUME_LOCAL_STORAGE_KEY).catch(e => console.log(e));
    } else {
      localForage.setItem(AudioPlayer.SOUND_EFFECT_VOLUME_LOCAL_STORAGE_KEY, soundEffectVolume).catch(e => console.log(e));
    }
  }
 
  get isNoticeMute() { return AudioPlayer.isNoticeMute; }
  set isNoticeMute(isNoticeMute: boolean) {
    AudioPlayer.isNoticeMute = isNoticeMute;
    if (!isNoticeMute) {
      localForage.removeItem(AudioPlayer.NOTICE_IS_MUTE_LOCAL_STORAGE_KEY).catch(e => console.log(e));
    } else {
      localForage.setItem(AudioPlayer.NOTICE_IS_MUTE_LOCAL_STORAGE_KEY, isNoticeMute).catch(e => console.log(e));
    }
  }
  get noticeVolume(): number { return AudioPlayer.noticeVolume; }
  set noticeVolume(noticeVolume: number) {
    this.isNoticeMute = (noticeVolume == 0);
    AudioPlayer.noticeVolume = noticeVolume;
    //EventSystem.trigger('CHANGE_JUKEBOX_VOLUME', null);
    if (AudioPlayer.noticeVolume == 0.5) {
      localForage.removeItem(AudioPlayer.NOTICE_VOLUME_LOCAL_STORAGE_KEY).catch(e => console.log(e));
    } else {
      localForage.setItem(AudioPlayer.NOTICE_VOLUME_LOCAL_STORAGE_KEY, noticeVolume).catch(e => console.log(e));
    }
  }

  get audios(): AudioFile[] { return AudioStorage.instance.audios.filter(audio => !audio.isHidden); }
  get jukebox(): Jukebox { return ObjectStore.instance.get<Jukebox>('Jukebox'); }

  get percentVolume(): number { return Math.floor(this.volume * 100); }
  set percentVolume(percentVolume: number) { this.volume = percentVolume / 100; }

  get percentAuditionVolume(): number { return Math.floor(this.auditionVolume * 100); }
  set percentAuditionVolume(percentAuditionVolume: number) { this.auditionVolume = percentAuditionVolume / 100; }

  get percentSoundEffectVolume(): number { return Math.floor(this.soundEffectVolume * 100); }
  set percentSoundEffectVolume(percentSoundEffectVolume: number) { this.soundEffectVolume = percentSoundEffectVolume / 100; }

  get percentNoticeVolume(): number { return Math.floor(this.noticeVolume * 100); }
  set percentNoticeVolume(percentNoticeVolume: number) { this.noticeVolume = percentNoticeVolume / 100; }

  readonly auditionPlayer: AudioPlayer = new AudioPlayer();
  private lazyUpdateTimer: NodeJS.Timer = null;

  private readonly soundTestPlayer: AudioPlayer = new AudioPlayer();
  private readonly noticeTestPlayer: AudioPlayer = new AudioPlayer();

  constructor(
    private modalService: ModalService,
    private panelService: PanelService,
    private ngZone: NgZone,
    private contextMenuService: ContextMenuService
  ) {
    this.soundTestPlayer.volumeType = VolumeType.SOUND_EFFECT;
    this.noticeTestPlayer.volumeType = VolumeType.NOTICE;
  }

  ngOnInit() {
    Promise.resolve().then(() => this.modalService.title = this.panelService.title = 'ジュークボックス');
    this.auditionPlayer.volumeType = VolumeType.AUDITION;
    EventSystem.register(this)
      .on('*', event => {
        if (event.eventName.startsWith('FILE_')) this.lazyNgZoneUpdate();
      });
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
    this.stop();
  }

  play(audio: AudioFile) {
    this.auditionPlayer.play(audio);
  }

  stop() {
    this.auditionPlayer.stop();
  }

  playBGM(audio: AudioFile) {
    this.jukebox.play(audio.identifier, true);
  }

  stopBGM(audio: AudioFile) {
    if (this.jukebox.audio === audio) this.jukebox.stop();
  }

  handleFileSelect(event: Event) {
    let input = <HTMLInputElement>event.target;
    let files = input.files;
    if (files.length) FileArchiver.instance.load(files);
    input.value = '';
  }

  noticeTest(audioIdentifier=PresetSound.puyon) {
    const audio = AudioStorage.instance.get(audioIdentifier);
    if (audio && audio.isReady) {
      this.noticeTestPlayer.play(audio);
    }
  }
  
  soundTest(event: Event) {
    const button = <HTMLElement>event.target;
    const clientRect = button.getBoundingClientRect();
    const position = { x: window.pageXOffset + clientRect.left + button.clientWidth, y: window.pageYOffset + clientRect.top };
    const menu: ContextMenuAction[] = [
      { name: 'キャラクター・地形', subActions: [
        { name: 'キャラクターの移動開始', action: () => { this.playSETest(PresetSound.piecePick); }},
        { name: 'キャラクターを置く', action: () => { this.playSETest(PresetSound.piecePut); }},
        { name: '地形の移動開始／終了', action: () => { this.playSETest(PresetSound.blockPick); }},
      ]},
      { name: 'ダイス・コイン', subActions: [
        { name: 'ダイスシンボルを取る', action: () => { this.playSETest(PresetSound.dicePick); }},
        { name: 'ダイスシンボルを置く', action: () => { this.playSETest(PresetSound.dicePut); }},
        { name: 'ダイスを振る１', action: () => { this.playSETest(PresetSound.diceRoll1); }},
        { name: 'ダイスを振る２', action: () => { this.playSETest(PresetSound.diceRoll2); }},
        { name: 'コイントス', action: () => { this.playSETest(PresetSound.coinToss); }},
      ]},
      { name: 'カード・山札', subActions: [
        { name: 'カードを引く／裏返す', action: () => { this.playSETest(PresetSound.cardDraw); }},
        { name: 'カード・山札を取る', action: () => { this.playSETest(PresetSound.cardPick); }},
        { name: 'カード・山札を置く', action: () => { this.playSETest(PresetSound.cardPut); }},
        { name: '山札をシャッフル', action: () => { this.playSETest(PresetSound.cardShuffle); }},
      ]},
      { name: 'その他', subActions: [
        { name: '固定・ロック／解除', action: () => { this.playSETest(PresetSound.lock); }},
        { name: '落下／取り除く／削除', action: () => { this.playSETest(PresetSound.sweep); }},
        { name: 'オブジェクト選択', action: () => { this.playSETest(PresetSound.selectionStart); }},
        { name: '変身！', action: () => { this.playSETest(PresetSound.surprise); }}
      ]}
    ];
    this.contextMenuService.open(position, menu, 'SEテスト');
  }

  private playSETest(audioIdentifier) {
    const audio = AudioStorage.instance.get(audioIdentifier);
    if (audio && audio.isReady) {
      EventSystem.unregister(this, 'UPDATE_AUDIO_RESOURE');
      if (!this.isSoundEffectMute) this.soundTestPlayer.play(audio);
    } else {
      EventSystem.register(this)
      .on('UPDATE_AUDIO_RESOURE', -100, event => {
        this.playSETest(audioIdentifier);
      });
    }
  }

  private lazyNgZoneUpdate() {
    if (this.lazyUpdateTimer !== null) return;
    this.lazyUpdateTimer = setTimeout(() => {
      this.lazyUpdateTimer = null;
      this.ngZone.run(() => { });
    }, 100);
  }
}
