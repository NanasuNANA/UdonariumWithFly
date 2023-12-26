import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  ViewChild
} from '@angular/core';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { EventSystem } from '@udonarium/core/system';
import { StringUtil } from '@udonarium/core/system/util/string-util';
import { MathUtil } from '@udonarium/core/system/util/math-util';
import { PresetSound, SoundEffect } from '@udonarium/sound-effect';
import { TextNote } from '@udonarium/text-note';
import { GameCharacterSheetComponent } from 'component/game-character-sheet/game-character-sheet.component';
import { OpenUrlComponent } from 'component/open-url/open-url.component';
import { InputHandler } from 'directive/input-handler';
import { MovableOption } from 'directive/movable.directive';
import { RotableOption } from 'directive/rotable.directive';
import { ModalService } from 'service/modal.service';
import { ContextMenuAction, ContextMenuSeparator, ContextMenuService } from 'service/context-menu.service';
import { PanelOption, PanelService } from 'service/panel.service';
import { PointerDeviceService } from 'service/pointer-device.service';
import { SelectionState, TabletopSelectionService } from 'service/tabletop-selection.service';

@Component({
  selector: 'text-note',
  templateUrl: './text-note.component.html',
  styleUrls: ['./text-note.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TextNoteComponent implements OnChanges, OnDestroy {
  @ViewChild('textArea', { static: true }) textAreaElementRef: ElementRef;

  @Input() textNote: TextNote = null;
  @Input() is3D: boolean = false;

  get title(): string { return this.textNote.title; }
  get text(): string { this.calcFitHeightIfNeeded(); return this.textNote.text; }
  set text(text: string) { this.calcFitHeightIfNeeded(); this.textNote.text = text; }

  get color(): string { return this.textNote.color; }
  set color(color: string) { this.textNote.color = color; }

  get textShadowCss(): string {
    const shadow = StringUtil.textShadowColor(this.color, '#f2f2f2', '#000000');
    return `${shadow} 0px 0px 0.5px, 
    ${shadow} 0px 0px 0.5px, 
    ${shadow} 0px 0px 0.5px, 
    ${shadow} 0px 0px 0.5px, 
    ${shadow} 0px 0px 0.5px, 
    ${shadow} 0px 0px 0.5px,
    ${shadow} 0px 0px 0.5px,
    ${shadow} 0px 0px 0.5px`;
  }

  get fontSize(): number { this.calcFitHeightIfNeeded(); return this.textNote.fontSize; }
  get imageFile(): ImageFile { return this.textNote.imageFile; }
  get rotate(): number { return this.textNote.rotate; }
  set rotate(rotate: number) { this.textNote.rotate = rotate; }
  get height(): number { return MathUtil.clampMin(this.textNote.height); }
  get width(): number { return MathUtil.clampMin(this.textNote.width); }

  get altitude(): number { return this.textNote.altitude; }
  set altitude(altitude: number) { this.textNote.altitude = altitude; }

  get textNoteAltitude(): number {
    let ret = this.altitude;
    if (this.isUpright && this.altitude < 0) {
      if (-this.height <= this.altitude) return 0;
      ret += this.height;
    }
    return +ret.toFixed(1); 
  }

  get isUpright(): boolean { return this.textNote.isUpright; }
  set isUpright(isUpright: boolean) { this.textNote.isUpright = isUpright; }

  get isAltitudeIndicate(): boolean { return this.textNote.isAltitudeIndicate; }
  set isAltitudeIndicate(isAltitudeIndicate: boolean) { this.textNote.isAltitudeIndicate = isAltitudeIndicate; }

  get isLocked(): boolean { return this.textNote.isLocked; }
  set isLocked(isLocked: boolean) { this.textNote.isLocked = isLocked; }

  get isShowTitle(): boolean { return this.textNote.isShowTitle; }
  set isShowTitle(isShowTitle: boolean) { this.textNote.isShowTitle = isShowTitle; }

  get isWhiteOut(): boolean { return this.textNote.isWhiteOut; }
  set isWhiteOut(isWhiteOut: boolean) { this.textNote.isWhiteOut = isWhiteOut; }

  get isEditorSelected(): boolean { return document.activeElement === this.textAreaElementRef.nativeElement; }
  get isActive(): boolean { return document.activeElement === this.textAreaElementRef.nativeElement; }

  get selectionState(): SelectionState { return this.selectionService.state(this.textNote); }
  get isSelected(): boolean { return this.selectionState !== SelectionState.NONE; }
  get isMagnetic(): boolean { return this.selectionState === SelectionState.MAGNETIC; }

  get rubiedText(): string {
    return StringUtil.rubyToHtml(StringUtil.escapeHtml(this.text));
  }
  
  private callbackOnMouseUp = (e) => this.onMouseUp(e);

  gridSize: number = 50;
  math = Math;

  private calcFitHeightTimer: NodeJS.Timeout = null;

  movableOption: MovableOption = {};
  rotableOption: RotableOption = {};

  constructor(
    private ngZone: NgZone,
    private contextMenuService: ContextMenuService,
    private elementRef: ElementRef<HTMLElement>,
    private panelService: PanelService,
    private changeDetector: ChangeDetectorRef,
    private pointerDeviceService: PointerDeviceService,
    private modalService: ModalService,
    private selectionService: TabletopSelectionService
  ) { }

  viewRotateZ = 10;
  private input: InputHandler = null;
  
  get isInverse(): boolean {
    const rotate = Math.abs(this.viewRotateZ + this.rotate) % 360;
    return 90 < rotate && rotate < 270
  }

  ngOnChanges(): void {
    EventSystem.unregister(this);
    EventSystem.register(this)
      .on(`UPDATE_GAME_OBJECT/identifier/${this.textNote?.identifier}`, event => {
        this.changeDetector.markForCheck();
      })
      .on(`UPDATE_OBJECT_CHILDREN/identifier/${this.textNote?.identifier}`, event => {
        this.changeDetector.markForCheck();
      })
      .on('SYNCHRONIZE_FILE_LIST', event => {
        this.changeDetector.markForCheck();
      })
      .on('UPDATE_FILE_RESOURE', event => {
        this.changeDetector.markForCheck();
      })
      .on<object>('TABLE_VIEW_ROTATE', -1000, event => {
        this.ngZone.run(() => {
          this.viewRotateZ = event.data['z'];
          this.changeDetector.markForCheck();
        })
      })
      .on(`UPDATE_SELECTION/identifier/${this.textNote?.identifier}`, event => {
        this.changeDetector.markForCheck();
      });
    this.movableOption = {
      tabletopObject: this.textNote,
      transformCssOffset: 'translateZ(0.17px)',
      colideLayers: ['terrain']
    };
    this.rotableOption = {
      tabletopObject: this.textNote
    };
  }
  
  ngAfterViewInit() {
    this.ngZone.runOutsideAngular(() => {
      this.input = new InputHandler(this.elementRef.nativeElement);
    });
    this.input.onStart = this.onInputStart.bind(this);
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
    this.input.destroy();
  }

  @HostListener('dragstart', ['$event'])
  onDragstart(e) {
    e.stopPropagation();
    e.preventDefault();
  }

  onInputStart(e: any) {
    this.input.cancel();

    // TODO:もっと良い方法考える
    if (this.isLocked) {
      EventSystem.trigger('DRAG_LOCKED_OBJECT', { srcEvent: e });
    }
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(e: any) {
    if (this.isActive || this.isLocked) return;
    e.preventDefault();
    this.textNote.toTopmost();

    // TODO:もっと良い方法考える
    if (e.button === 2) {
      EventSystem.trigger('DRAG_LOCKED_OBJECT', { srcEvent: e });
      return;
    }

    this.addMouseEventListeners();
  }

  onMouseUp(e: any) {
    if (this.pointerDeviceService.isAllowedToOpenContextMenu) {
      let selection = window.getSelection();
      if (!selection.isCollapsed) selection.removeAllRanges();
      this.textAreaElementRef.nativeElement.focus();
    }
    this.removeMouseEventListeners();
    e.preventDefault();
  }

  onRotateMouseDown(e: any) {
    e.stopPropagation();
    e.preventDefault();
  }

  @HostListener('contextmenu', ['$event'])
  onContextMenu(e: Event) {
    this.removeMouseEventListeners();
    if (this.isActive) return;
    e.stopPropagation();
    e.preventDefault();

    if (!this.pointerDeviceService.isAllowedToOpenContextMenu) return;
    let position = this.pointerDeviceService.pointers[0];

    let menuActions: ContextMenuAction[] = [];
    menuActions = menuActions.concat(this.makeSelectionContextMenu());
    menuActions = menuActions.concat(this.makeContextMenu());

    this.contextMenuService.open(position, menuActions, this.title);
  }

  onMove() {
    this.contextMenuService.close();
    SoundEffect.play(PresetSound.cardPick);
  }

  onMoved() {
    SoundEffect.play(PresetSound.cardPut);
  }

  private makeSelectionContextMenu(): ContextMenuAction[] {
    if (this.selectionService.objects.length < 1) return [];

    let actions: ContextMenuAction[] = [];

    let objectPosition = { x: this.textNote.location.x, y: this.textNote.location.y, z: this.textNote.posZ };
    actions.push({ name: 'ここに集める', action: () => this.selectionService.congregate(objectPosition) });
    actions.push(ContextMenuSeparator);

    return actions;
  }

  private makeContextMenu(): ContextMenuAction[] {
    let actions: ContextMenuAction[] = [
      (this.isLocked
        ? {
          name: '☑ 固定', action: () => {
            this.isLocked = false;
            SoundEffect.play(PresetSound.unlock);
          },
          checkBox: 'check'
        } : {
          name: '☐ 固定', action: () => {
            this.isLocked = true;
            SoundEffect.play(PresetSound.lock);
          },
          checkBox: 'check'
        }),
      ContextMenuSeparator,
      (this.isUpright
        ? {
          name: '☑ 直立', action: () => {
            //this.transition = true;
            this.isUpright = false;
          },
          checkBox: 'check'
        } : {
          name: '☐ 直立', action: () => {
            //this.transition = true;
            this.isUpright = true;
          },
          checkBox: 'check'
        }),
      (this.isShowTitle
        ? {
          name: '☑ タイトルバーの表示', action: () => {
            this.isShowTitle = false;
          },
          checkBox: 'check'
        } : {
          name: '☐ タイトルバーの表示', action: () => {
            this.isShowTitle = true;
          },
          checkBox: 'check'
        }),
      (this.isWhiteOut
        ? {
          name: '☑ 背景の色抜き', action: () => {
            this.isWhiteOut = false;
          },
          checkBox: 'check'
        } : {
          name: '☐ 背景の色抜き', action: () => {
            this.isWhiteOut = true;
          },
          checkBox: 'check'
        }),
      ContextMenuSeparator,
      (this.isAltitudeIndicate
        ? {
          name: '☑ 高度の表示', action: () => {
            this.isAltitudeIndicate = false;
          },
          checkBox: 'check'
        } : {
          name: '☐ 高度の表示', action: () => {
            this.isAltitudeIndicate = true;
          },
          checkBox: 'check'
        }),
      {
        name: '高度を0にする', action: () => {
          if (this.altitude != 0) {
            this.altitude = 0;
            SoundEffect.play(PresetSound.sweep);
          }
        },
        altitudeHande: this.textNote
      },
      ContextMenuSeparator,
      { name: 'メモを編集...', action: () => { this.showDetail(this.textNote); } },
      (this.textNote.getUrls().length <= 0 ? null : {
        name: '参照URLを開く', action: null,
        subActions: this.textNote.getUrls().map((urlElement) => {
          const url = urlElement.value.toString();
          return {
            name: urlElement.name ? urlElement.name : url,
            action: () => {
              if (StringUtil.sameOrigin(url)) {
                window.open(url.trim(), '_blank', 'noopener');
              } else {
                this.modalService.open(OpenUrlComponent, { url: url, title: this.textNote.title, subTitle: urlElement.name });
              } 
            },
            disabled: !StringUtil.validUrl(url),
            error: !StringUtil.validUrl(url) ? 'URLが不正です' : null,
            isOuterLink: StringUtil.validUrl(url) && !StringUtil.sameOrigin(url)
          };
        })
      }),
      (this.textNote.getUrls().length <= 0 ? null : ContextMenuSeparator),
      {
        name: 'コピーを作る', action: () => {
          let cloneObject = this.textNote.clone();
          cloneObject.isLocked = false;
          cloneObject.location.x += this.gridSize;
          cloneObject.location.y += this.gridSize;
          cloneObject.toTopmost();
          SoundEffect.play(PresetSound.cardPut);
        }
      },
      {
        name: '削除する', action: () => {
          this.textNote.destroy();
          SoundEffect.play(PresetSound.sweep);
        }
      },
    ];

    return actions;
  }

  calcFitHeightIfNeeded() {
    if (this.calcFitHeightTimer) return;
    this.ngZone.runOutsideAngular(() => {
      this.calcFitHeightTimer = setTimeout(() => {
        this.calcFitHeight();
        this.calcFitHeightTimer = null;
      }, 0);
    });
  }

  calcFitHeight() {
    let textArea: HTMLTextAreaElement = this.textAreaElementRef.nativeElement;
    textArea.style.height = '0';
    if (textArea.scrollHeight > textArea.offsetHeight) {
      textArea.style.height = textArea.scrollHeight + 'px';
    }
  }

  lastNewLineAdjust(str: string): string {
    if (str == null) return '';
    return (!this.isSelected && str.lastIndexOf("\n") == str.length - 1) ? str + "\n" : str;
  }

  private addMouseEventListeners() {
    document.body.addEventListener('mouseup', this.callbackOnMouseUp, false);
  }

  private removeMouseEventListeners() {
    document.body.removeEventListener('mouseup', this.callbackOnMouseUp, false);
  }

  private showDetail(gameObject: TextNote) {
    EventSystem.trigger('SELECT_TABLETOP_OBJECT', { identifier: gameObject.identifier, className: gameObject.aliasName });
    let coordinate = this.pointerDeviceService.pointers[0];
    let title = '共有メモ設定';
    if (gameObject.title.length) title += ' - ' + gameObject.title;
    let option: PanelOption = { title: title, left: coordinate.x - 350, top: coordinate.y - 200, width: 560, height: 470 };
    let component = this.panelService.open<GameCharacterSheetComponent>(GameCharacterSheetComponent, option);
    component.tabletopObject = gameObject;
  }

  activate() {
    if (!this.isLocked) this.textAreaElementRef.nativeElement.focus();
  }
}
