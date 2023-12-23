import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  NgZone,
  OnChanges,
  OnDestroy
} from '@angular/core';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { EventSystem, Network } from '@udonarium/core/system';
import { StringUtil } from '@udonarium/core/system/util/string-util';
import { MathUtil } from '@udonarium/core/system/util/math-util';
import { GameTableMask } from '@udonarium/game-table-mask';
import { PresetSound, SoundEffect } from '@udonarium/sound-effect';
import { GameCharacterSheetComponent } from 'component/game-character-sheet/game-character-sheet.component';
import { OpenUrlComponent } from 'component/open-url/open-url.component';
import { InputHandler } from 'directive/input-handler';
import { MovableOption } from 'directive/movable.directive';
import { ModalService } from 'service/modal.service';
import { ContextMenuAction, ContextMenuSeparator, ContextMenuService } from 'service/context-menu.service';
import { CoordinateService } from 'service/coordinate.service';
import { PanelOption, PanelService } from 'service/panel.service';
import { PointerDeviceService } from 'service/pointer-device.service';
import { TabletopActionService } from 'service/tabletop-action.service';
import { UUID } from '@udonarium/core/system/util/uuid';
import { animate, keyframes, style, transition, trigger } from '@angular/animations';
import { TableSelecter } from '@udonarium/table-selecter';
import { ConfirmationComponent, ConfirmationType } from 'component/confirmation/confirmation.component';
import { ChatMessageService } from 'service/chat-message.service';
import { PeerCursor } from '@udonarium/peer-cursor';
import { xor } from 'lodash';
import { SelectionState, TabletopSelectionService } from 'service/tabletop-selection.service';

@Component({
  selector: 'game-table-mask',
  templateUrl: './game-table-mask.component.html',
  styleUrls: ['./game-table-mask.component.css'],
  animations: [
    trigger('fadeInOut', [
      transition('void => *', [
        animate('132ms ease-out', keyframes([
          style({ opacity: 0, offset: 0 }),
          style({ opacity: 1, offset: 1.0 })
        ]))
      ]),
      transition('* => void', [
        animate('132ms ease-in', keyframes([
          style({ opacity: 1, offset: 0 }),
          style({ opacity: 0, offset: 1.0 })
        ]))
      ])
    ]),
    trigger('rotateInOut', [
      transition('scrached<=>restore', [
        animate('132ms ease-in-out', keyframes([
          style({ transform: 'rotateY(0deg)', offset: 0.0 }),
          style({ transform: 'rotateY(-90deg)', offset: 1.0 })
        ]))
      ])
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GameTableMaskComponent implements OnChanges, OnDestroy, AfterViewInit {
  @Input() gameTableMask: GameTableMask = null;
  @Input() is3D: boolean = false;

  get name(): string { return this.gameTableMask.name; }
  get width(): number { return MathUtil.clampMin(this.gameTableMask.width); }
  get height(): number { return MathUtil.clampMin(this.gameTableMask.height); }
  get opacity(): number { return this.gameTableMask.opacity; }
  get imageFile(): ImageFile { return this.gameTableMask.imageFile; }
  get isLock(): boolean { return this.gameTableMask.isLock; }
  set isLock(isLock: boolean) { this.gameTableMask.isLock = isLock; }
  get blendType(): number { return this.gameTableMask.blendType; }
  set blendType(blendType: number) { this.gameTableMask.blendType = blendType; }

  get fontSize(): number { return this.gameTableMask.fontsize; }
  set fontSize(fontSize: number) { this.gameTableMask.fontsize = fontSize; }
  get text(): string { return this.gameTableMask.text; }
  set text(text: string) { this.gameTableMask.text = text; }
  get color(): string { return this.gameTableMask.color; }
  set color(color: string) { this.gameTableMask.color = color; }
  get bgcolor(): string { return this.gameTableMask.bgcolor; }
  set bgcolor(bgcolor: string) { this.gameTableMask.bgcolor = bgcolor; }

  get isPreview(): boolean { return this.gameTableMask.isPreview; }
  set isPreview(isPreview: boolean) { this.gameTableMask.isPreview = isPreview; }
  get isPreviewMode(): boolean {
    if (!this.gameTableMask) return false;
    return this.isGMMode && this.gameTableMask.isScratchPreviewOnGMMode
     || this.isPreview && this.gameTableMask.isMine;
  }

  get textShadowCss(): string {
    const shadow = StringUtil.textShadowColor(this.color);
    return `${shadow} 0px 0px 2px, 
      ${shadow} 0px 0px 2px, 
      ${shadow} 0px 0px 2px, 
      ${shadow} 0px 0px 2px, 
      ${shadow} 0px 0px 2px, 
      ${shadow} 0px 0px 2px,
      ${shadow} 0px 0px 2px,
      ${shadow} 0px 0px 2px`;
  }

  get scratchedGrids() {
    return this.gameTableMask.scratchedGrids;
  }
  set scratchedGrids(scratchedGrids: string) {
    this.gameTableMask.scratchedGrids = scratchedGrids;
  }

  get scratchingGrids() {
    return this.gameTableMask.scratchingGrids;
  }
  set scratchingGrids(scratchingGrids: string) {
    this.gameTableMask.scratchingGrids = scratchingGrids;
  }

  get isNonScratched(): boolean {
    return !this.gameTableMask.scratchedGrids;
  }

  get isNonScratching(): boolean {
    return !(this.gameTableMask.scratchingGrids || this._currentScratchingSet);
  }

  get masksCss(): string {
    if (!this.isPreviewMode && this.isNonScratched) return '';
    const masks: string[] = [];
    const scratchedSet: Set<string> = new Set(this.scratchedGrids.split(/,/g));
    const scratchingSet: Set<string> = this._currentScratchingSet ? this._currentScratchingSet : new Set(this.scratchingGrids.split(/,/g));
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        const gridStr = `${x}:${y}`;
        if (this.isPreviewMode) {
          if (scratchedSet.has(gridStr) && !scratchingSet.has(gridStr)) continue;
          if (scratchingSet.has(gridStr) && !scratchedSet.has(gridStr)) continue;
        } else {
          if (scratchedSet.has(gridStr)) continue;
        }
        masks.push(`radial-gradient(#000, #000) ${ x * this.gridSize - 1 }px ${ y * this.gridSize -1 }px / ${ this.gridSize + 2 }px ${ this.gridSize + 2 }px no-repeat`);
      }
    }
    return masks.length ? masks.join(',') : 'radial-gradient(#000, #000) 0px 0px / 0px 0px no-repeat';
  }
  
  get scratchingGridInfos(): {x: number, y: number, state: string}[] {
    const ret: {x: number, y: number, state: string}[] = [];
    if (!this.gameTableMask || (this.isNonScratching && this.isNonScratched)) return ret;
    const scratchingGridSet: Set<string> = this._currentScratchingSet ? this._currentScratchingSet : new Set(this.scratchingGrids.split(/,/g));
    const scratchedGridSet: Set<string> = new Set(this.scratchedGrids.split(/,/g));
    for (let x = 0; x < Math.ceil(this.width); x++) {
      for (let y = 0; y < Math.ceil(this.height); y++) {
        const gridStr = `${x}:${y}`;
        if (scratchingGridSet.has(gridStr) || scratchedGridSet.has(gridStr)) ret.push({ 
          x: x, 
          y: y, 
          state: !scratchingGridSet.has(gridStr) ? 'scrached' : 
            !scratchedGridSet.has(gridStr) ? 'scraching' 
            : 'restore'
        });
      }
    }
    return ret;
  }

  get operateOpacity(): number {
    const ret = this.opacity * ((this.isGMMode && this.gameTableMask.isTransparentOnGMMode) || (this.isPreview && this.gameTableMask.isMine) ? 0.6 : 1);
    return (ret < 0.4 && this.isScratching) ? 0.4 : ret;
  }

  get altitude(): number { return this.gameTableMask.altitude; }
  set altitude(altitude: number) { this.gameTableMask.altitude = altitude; }

  get isAltitudeIndicate(): boolean { return this.gameTableMask.isAltitudeIndicate; }
  set isAltitudeIndicate(isAltitudeIndicate: boolean) { this.gameTableMask.isAltitudeIndicate = isAltitudeIndicate; }

  get gameTableMaskAltitude(): number {
    return +this.altitude.toFixed(1); 
  }
  
  get rubiedText(): string {
    return StringUtil.rubyToHtml(StringUtil.escapeHtml(this.text));
  }

  get isInverse(): boolean {
    return 90 < Math.abs(this.viewRotateZ) % 360 && Math.abs(this.viewRotateZ) % 360 < 270
  }

  get isGMMode(): boolean { return this.gameTableMask.isGMMode; }
  get isScratching(): boolean { return !!this.gameTableMask.owner; }

  get hasOwner(): boolean { return this.gameTableMask.hasOwner; }
  get ownerIsOnline(): boolean { return this.gameTableMask.ownerIsOnline; }
  get ownerName(): string { return this.gameTableMask.ownerName; }
  get ownerColor(): string { return this.gameTableMask.ownerColor; }

  panelId;
  
  get selectionState(): SelectionState { return this.selectionService.state(this.gameTableMask); }
  get isSelected(): boolean { return this.selectionState !== SelectionState.NONE; }
  get isMagnetic(): boolean { return this.selectionState === SelectionState.MAGNETIC; }

  gridSize: number = 50;
  math = Math;
  viewRotateZ = 10;

  movableOption: MovableOption = {};

  private input: InputHandler = null;

  constructor(
    private ngZone: NgZone,
    private tabletopActionService: TabletopActionService,
    private contextMenuService: ContextMenuService,
    private elementRef: ElementRef<HTMLElement>,
    private panelService: PanelService,
    private changeDetector: ChangeDetectorRef,
    private selectionService: TabletopSelectionService,
    private pointerDeviceService: PointerDeviceService,
    private modalService: ModalService,
    private coordinateService: CoordinateService,
    private chatMessageService: ChatMessageService
  ) { }

  ngOnChanges(): void {
    EventSystem.unregister(this);
    EventSystem.register(this)
      .on(`UPDATE_GAME_OBJECT/identifier/${this.gameTableMask?.identifier}`, event => {
        this.changeDetector.markForCheck();
      })
      .on(`UPDATE_OBJECT_CHILDREN/identifier/${this.gameTableMask?.identifier}`, event => {
        this.changeDetector.markForCheck();
      })
      .on('CHANGE_GM_MODE', event => {
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
        });
      })
      .on(`UPDATE_SELECTION/identifier/${this.gameTableMask?.identifier}`, event => {
        this.changeDetector.markForCheck();
      });
    this.movableOption = {
      tabletopObject: this.gameTableMask,
      transformCssOffset: 'translateZ(0.10px)',
      colideLayers: ['terrain']
    };
    this.panelId = UUID.generateUuid();
  }

  ngAfterViewInit() {
    this.ngZone.runOutsideAngular(() => {
      this.input = new InputHandler(this.elementRef.nativeElement);
    });
    this.input.onStart = this.onInputStart.bind(this);
    this.input.onMove = this.onInputMove.bind(this);
  }

  ngOnDestroy() {
    this.input.destroy();
    EventSystem.unregister(this);
    clearTimeout(this._scratchingTimerId);
  }

  @HostListener('dragstart', ['$event'])
  onDragstart(e) {
    e.stopPropagation();
    e.preventDefault();
  }

  onInputStart(e: any) {
    if (!this.isScratching || !this.gameTableMask.isMine) { 
      this.input.cancel();
    } else if (!window.PointerEvent && e.button < 2 && e.buttons < 2) {
      this.scratching(true);
    }
    //console.log(e)
    // TODO:もっと良い方法考える
    if ((this.isLock && !this.isScratching) || (this.isScratching && !this.gameTableMask.isMine)) {
      EventSystem.trigger('DRAG_LOCKED_OBJECT', { srcEvent: e });
    }
  }

  @HostListener('pointerdown', ['$event'])
  onInputStartPointer(e: PointerEvent) {
    if (!this.isScratching || !this.gameTableMask.isMine) { 
      //this.input.cancel();
    } else if (e.button < 2 && e.buttons < 2) {
      this.scratching(true, {offsetX: e.offsetX, offsetY: e.offsetY});
    }
  }

  private _scratchingGridX = -1;
  private _scratchingGridY = -1;
  onInputMove(e: any) {
    if (!window.PointerEvent && this.isScratching && this.gameTableMask.isMine && this.input.isDragging) {
      this.scratching(false);
    }
  }

  @HostListener('pointermove', ['$event'])
  onInputMovePointer(e: PointerEvent) {
    if (this.isScratching && this.gameTableMask.isMine && this.input.isDragging && e.buttons < 2) {
      this.scratching(false, {offsetX: e.offsetX, offsetY: e.offsetY});
    }
  }

  private _currentScratchingSet: Set<string>;
  private _scratchingTimerId;
  scratching(isStart: boolean, position: {offsetX: number, offsetY: number} = null) {
    if (!this.gameTableMask.isMine) return;
    // とりあえず、本当は周辺を表示したい。
    const tableSelecter = TableSelecter.instance;
    if (!tableSelecter.gridShow) tableSelecter.viewTable.gridClipRect = {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      };
    //viewTable.gridHeight = this.gameTableMask.posZ + this.gameTableMask.altitude * this.gridSize + 0.5;
    let offsetX
    let offsetY;
    if (position) {
      offsetX = position.offsetX;
      offsetY = position.offsetY;
    } else {
      const scratchingPosition = this.coordinateService.calcTabletopLocalCoordinate(this.pointerDeviceService.pointers[0], this.elementRef.nativeElement);
      offsetX = scratchingPosition.x - this.gameTableMask.location.x;
      offsetY = scratchingPosition.y - this.gameTableMask.location.y;
    }
    if (offsetX < 0 || this.gameTableMask.width * this.gridSize <= offsetX || offsetY < 0 || this.gameTableMask.height * this.gridSize <= offsetY) return;
    const gridX = Math.floor(offsetX / this.gridSize);
    const gridY = Math.floor(offsetY / this.gridSize);

    if (!isStart && this._scratchingGridX === gridX && this._scratchingGridY === gridY) return;
    const tempScratching = `${gridX}:${gridY}`;
    this._scratchingGridX = gridX;
    this._scratchingGridY = gridY;
    if (!this._currentScratchingSet) this._currentScratchingSet = new Set(this.scratchingGrids.split(/,/g));
    if (this._currentScratchingSet.has(tempScratching)) {
      this._currentScratchingSet.delete(tempScratching);
    } else {
      this._currentScratchingSet.add(tempScratching);
    }
    clearTimeout(this._scratchingTimerId);
    this._scratchingTimerId = setTimeout(() => {
      this.scratchingGrids = Array.from(this._currentScratchingSet).filter(grid => grid && /^\d+:\d+$/.test(grid)).sort().join(',');
      this._currentScratchingSet = null;
    }, 250);
  }

  scratched() {
    const currentScratchedAry: string[] = this.scratchedGrids.split(/,/g);
    if (this._currentScratchingSet) {
      clearTimeout(this._scratchingTimerId);
      this.scratchingGrids = Array.from(this._currentScratchingSet).filter(grid => grid && /^\d+:\d+$/.test(grid)).sort().join(',');
      this._currentScratchingSet = null;
    }
    const currentScratchingAry: string[] = this.scratchingGrids.split(/,/g);
    this.scratchedGrids = xor(currentScratchedAry, currentScratchingAry).filter(grid => grid && /^\d+:\d+$/.test(grid)).sort().join(',');
  }

  @HostListener('contextmenu', ['$event'])
  onContextMenu(e: Event) {
    e.stopPropagation();
    e.preventDefault();

    if (!this.pointerDeviceService.isAllowedToOpenContextMenu) return;
    let menuPosition = this.pointerDeviceService.pointers[0];

    let menuActions: ContextMenuAction[] = [];
    menuActions = menuActions.concat(this.makeSelectionContextMenu());
    menuActions = menuActions.concat(this.makeContextMenu());

    this.contextMenuService.open(menuPosition, menuActions, this.name);
  }

  onMove() {
    this.contextMenuService.close();
    SoundEffect.play(PresetSound.cardPick);
  }

  onMoved() {
    SoundEffect.play(PresetSound.cardPut);
  }

  scratchDone(e: Event=null) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!this.gameTableMask.isMine) return false;
    this.ngZone.run(() => {
      this.scratched();
      this.gameTableMask.owner = '';
      this.scratchingGrids = '';
      this.isPreview = false;
    });
    this._scratchingGridX = -1;
    this._scratchingGridY = -1;
    SoundEffect.play(PresetSound.cardPut);
    this.chatMessageService.sendOperationLog(`${ this.gameTableMask.name == '' ? '(無名のマップマスク)' : this.gameTableMask.name } のスクラッチを終了した`);
    return false;
  }

  scratchCancel(e: Event=null) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!this.gameTableMask.isMine && this.ownerIsOnline) return false;
    this.ngZone.run(() => {
      this.gameTableMask.owner = '';
      this.scratchingGrids = '';
      this.isPreview = false;
    });
    this._scratchingGridX = -1;
    this._scratchingGridY = -1;
    SoundEffect.play(PresetSound.unlock);
    this.chatMessageService.sendOperationLog(`${ this.gameTableMask.name == '' ? '(無名のマップマスク)' : this.gameTableMask.name } のスクラッチを終了した`);
    return false;
  }

  prevent(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  private makeSelectionContextMenu(): ContextMenuAction[] {
    if (this.selectionService.objects.length < 1) return [];

    let actions: ContextMenuAction[] = [];

    let objectPosition = this.coordinateService.calcTabletopLocalCoordinate();
    actions.push({ name: 'ここに集める', action: () => this.selectionService.congregate(objectPosition) });

    if (this.isSelected) {
      let selectedGameTableMasks = () => this.selectionService.objects.filter(object => object.aliasName === this.gameTableMask.aliasName) as GameTableMask[];
      actions.push(
        {
          name: '選択したマップマスク', action: null, subActions: [
            {
              name: 'すべて固定する', action: () => {
                selectedGameTableMasks().forEach(gameTableMask => gameTableMask.isLock = true);
                SoundEffect.play(PresetSound.lock);
              }
            },
            {
              name: 'すべてのコピーを作る', action: () => {
                selectedGameTableMasks().forEach(gameTableMask => {
                  let cloneObject = gameTableMask.clone();
                  cloneObject.location.x += this.gridSize;
                  cloneObject.location.y += this.gridSize;
                  cloneObject.isLock = false;
                  if (gameTableMask.parent) gameTableMask.parent.appendChild(cloneObject);
                });
                SoundEffect.play(PresetSound.cardPut);
              }
            },
          ]
        }
      );
    }
    actions.push(ContextMenuSeparator);
    return actions;
  }

  private makeContextMenu(): ContextMenuAction[] {
    let objectPosition = this.coordinateService.calcTabletopLocalCoordinate();
    let actions: ContextMenuAction[] = [
      (this.isGMMode ?
        this.gameTableMask.isTransparentOnGMMode ? {
          name: '☑ GM時透過表示', action: () => {
            this.gameTableMask.isTransparentOnGMMode = false;
          },
          checkBox: 'check'
        }
        : {
          name: '☐ GM時透過表示', action: () => {
            this.gameTableMask.isTransparentOnGMMode = true;
          },
          checkBox: 'check'
        }
      : null),
      (this.isGMMode ?
        this.gameTableMask.isScratchPreviewOnGMMode ? {
          name: '☑ GM時スクラッチプレビュー', action: () => {
            this.gameTableMask.isScratchPreviewOnGMMode = false;
          },
          checkBox: 'check'
        }
        : {
          name: '☐ GM時スクラッチプレビュー', action: () => {
            this.gameTableMask.isScratchPreviewOnGMMode = true;
          },
          checkBox: 'check'
        }
      : null),
      (this.isGMMode ? ContextMenuSeparator : null),
      (this.isLock
        ? {
          name: '☑ 固定', action: () => {
            this.isLock = false;
            //this.chatMessageService.sendOperationLog(`${this.gameTableMask.name} の固定を解除した`);
            SoundEffect.play(PresetSound.unlock);
          },
          disabled: this.isScratching,
          checkBox: 'check'
        }
        : {
          name: '☐ 固定', action: () => {
            this.isLock = true;
            SoundEffect.play(PresetSound.lock);
          },
          disabled: this.isScratching,
          checkBox: 'check'
        }
      ),
      (this.isLock ? null : { name: '重なり順', action: null, subActions: [
        {
          name: 'マップマスクの一番上に', action: () => {
            if (!this.isLock) {
              const parent = this.gameTableMask.parent;
              if (parent) parent.appendChild(this.gameTableMask);
            }
          },
          disabled: this.isLock
        },
        {
          name: 'マップマスクの一番下に', action: () => {
            if (!this.isLock) {
              const parent = this.gameTableMask.parent;
              if (parent) parent.prependChild(this.gameTableMask);
            }
          },
          disabled: this.isLock
        }],
        disabled: this.isLock
      }),
      ContextMenuSeparator,
      (!this.gameTableMask.isMine ?
        {
          name: 'スクラッチ開始', action: () => { 
            let isHandover = false;
            if (this.gameTableMask.owner != '') {
              this.isPreview = false;
              clearTimeout(this._scratchingTimerId);
              this._currentScratchingSet = null;
              const owner = PeerCursor.findByUserId(this.gameTableMask.owner);
              if (owner) {
                this.chatMessageService.sendOperationLog(`${ this.gameTableMask.name == '' ? '(無名のマップマスク)' : this.gameTableMask.name } のスクラッチを ${ owner.name == '' ? '(無名のプレイヤー)' : owner.name } から引き継いだ`);
                isHandover = true;
              }
            }
            this.gameTableMask.owner = Network.peer.userId;
            this._scratchingGridX = -1;
            this._scratchingGridY = -1;
            SoundEffect.play(PresetSound.lock);
            if (!isHandover) this.chatMessageService.sendOperationLog(`${ this.gameTableMask.name == '' ? '(無名のマップマスク)' : this.gameTableMask.name } のスクラッチを開始した`);
          },
        } : {
          name: `スクラッチ${ this.isNonScratching ? '終了' : '確定' }`, action: () => { this.scratchDone(); },
        }
      ),
      {
        name: 'スクラッチキャンセル', action: () => { this.scratchCancel(); },
        disabled: !this.isScratching || (!this.gameTableMask.isMine && this.ownerIsOnline)
      },
      {
        name: 'スクラッチ操作',
        subActions: [
          { 
            name: '適用して続ける', action: () => {
              if (!this.gameTableMask.isMine) return;
              this.ngZone.run(() => {
                this.scratched();
                this.scratchingGrids = '';
              });
              this._scratchingGridX = -1;
              this._scratchingGridY = -1;
              SoundEffect.play(PresetSound.cardDraw);
            },
            disabled: !this.gameTableMask.isMine || this.isNonScratching
          },
          { 
            name: '破棄して続ける' , action: () => {
              if (!this.gameTableMask.isMine) return;
              this.ngZone.run(() => {
                this.scratchingGrids = '';
                clearTimeout(this._scratchingTimerId);
                this._currentScratchingSet = null;
              });
              this._scratchingGridX = -1;
              this._scratchingGridY = -1;
              SoundEffect.play(PresetSound.sweep);
            },
            disabled: !this.gameTableMask.isMine || this.isNonScratching
          },
          ContextMenuSeparator,
          (this.isPreview
            ? {
              name: 'プレビューモード解除', action: () => {
                if (!this.gameTableMask.isMine) return;
                this.ngZone.run(() => {
                  this.isPreview = false;
                });
                SoundEffect.play(PresetSound.lock);
              },
              selfOnly: true,
              disabled: !this.gameTableMask.isMine
            }
            : {
              name: 'プレビューモード開始', action: () => {
                if (!this.gameTableMask.isMine) return;
                this.modalService.open(ConfirmationComponent, {
                  title: 'スクラッチプレビューモード', 
                  text: 'スクラッチ中に適用後の状態を表示しますか？',
                  helpHtml: '自分のみ、<b>このスクラッチを確定/キャンセルするまで</b>マップマスクは透過表示になり、またスクラッチ適用後の状態を表示します。',
                  type: ConfirmationType.OK_CANCEL,
                  materialIcon: 'visibility',
                  action: () => {
                    this.ngZone.run(() => {
                      this.isPreview = true;
                    });
                    SoundEffect.play(PresetSound.unlock);
                    this.chatMessageService.sendOperationLog(`${ this.gameTableMask.name == '' ? '(無名のマップマスク)' : this.gameTableMask.name } のスクラッチをプレビューモードにした`);
                  }
                });
              }, 
              selfOnly: true,
              disabled: !this.gameTableMask.isMine
            }
          ),
          { 
            name: 'スクラッチ初期化' , action: () => {
              if (!this.gameTableMask.isMine) return;
              this.modalService.open(ConfirmationComponent, {
                title: 'スクラッチ初期化', 
                text: 'スクラッチを初期化しますか？',
                help: 'マップマスクはスクラッチされていない状態になり、操作を終了します。',
                type: ConfirmationType.OK_CANCEL,
                materialIcon: 'draw',
                action: () => {
                  this.ngZone.run(() => {
                    this.gameTableMask.owner = '';
                    this.scratchedGrids = '';
                    this.scratchingGrids = '';
                    this._currentScratchingSet = null;
                    clearTimeout(this._scratchingTimerId);
                  });
                  this._scratchingGridX = -1;
                  this._scratchingGridY = -1;
                  SoundEffect.play(PresetSound.sweep);
                  this.chatMessageService.sendOperationLog(`${ this.gameTableMask.name == '' ? '(無名のマップマスク)' : this.gameTableMask.name } のスクラッチを初期化した`);
                }
              });
            },
            disabled: !this.gameTableMask.isMine || this.isNonScratched
          }
        ],
        disabled: !this.gameTableMask.isMine
      },
      ContextMenuSeparator,
      {
        name: '画像と色の表示',
        subActions: [
          { name: `${this.blendType == 0 ? '◉' : '○'} 画像のみ`,  action: () => { this.blendType = 0; SoundEffect.play(PresetSound.cardDraw) }, checkBox: 'radio' },
          { name: `${this.blendType == 1 ? '◉' : '○'} 背景色と重ねる`,  action: () => { this.blendType = 1; SoundEffect.play(PresetSound.cardDraw) }, checkBox: 'radio' },
          { name: `${this.blendType == 2 ? '◉' : '○'} 背景色と混ぜる`,  action: () => { this.blendType = 2; SoundEffect.play(PresetSound.cardDraw) }, checkBox: 'radio' },
          ContextMenuSeparator,
          { name: '色の初期化', action: () => { this.color = '#555555'; this.bgcolor = '#0a0a0a'; SoundEffect.play(PresetSound.cardDraw) } }
        ],
        disabled: this.isScratching
      },
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
        disabled: this.isScratching,
        altitudeHande: this.gameTableMask,
        altitudeDisabled: this.isScratching
      },
      ContextMenuSeparator,
      { name: 'マップマスクを編集...', action: () => { this.showDetail(this.gameTableMask); } },
      (this.gameTableMask.getUrls().length <= 0 ? null : {
        name: '参照URLを開く', action: null,
        subActions: this.gameTableMask.getUrls().map((urlElement) => {
          const url = urlElement.value.toString();
          return {
            name: urlElement.name ? urlElement.name : url,
            action: () => {
              if (StringUtil.sameOrigin(url)) {
                window.open(url.trim(), '_blank', 'noopener');
              } else {
                this.modalService.open(OpenUrlComponent, { url: url, title: this.gameTableMask.name, subTitle: urlElement.name });
              } 
            },
            disabled: !StringUtil.validUrl(url),
            error: !StringUtil.validUrl(url) ? 'URLが不正です' : null,
            isOuterLink: StringUtil.validUrl(url) && !StringUtil.sameOrigin(url)
          };
        })
      }),
      (this.gameTableMask.getUrls().length <= 0 ? null : ContextMenuSeparator),
      {
        name: 'コピーを作る', action: () => {
          let cloneObject = this.gameTableMask.clone();
          console.log('コピー', cloneObject);
          cloneObject.location.x += this.gridSize;
          cloneObject.location.y += this.gridSize;
          cloneObject.isLock = false;
          cloneObject.isPreview = false;
          if (this.gameTableMask.parent) this.gameTableMask.parent.appendChild(cloneObject);
          SoundEffect.play(PresetSound.cardPut);
        }
      },
      {
        name: '削除する', action: () => {
          this.chatMessageService.sendOperationLog(`${ this.gameTableMask.name == '' ? '(無名のマップマスク)' : this.gameTableMask.name } を削除した`);
          this.gameTableMask.destroy();
          SoundEffect.play(PresetSound.sweep);
        }
      },
      ContextMenuSeparator,
      { name: 'オブジェクト作成', action: null, subActions: this.tabletopActionService.makeDefaultContextMenuActions(objectPosition) }
    ];
    
    return actions;
  }

  private showDetail(gameObject: GameTableMask) {
    let coordinate = this.pointerDeviceService.pointers[0];
    let title = 'マップマスク設定';
    if (gameObject.name.length) title += ' - ' + gameObject.name;
    let option: PanelOption = { title: title, left: coordinate.x - 200, top: coordinate.y - 150, width: 400, height: 530 };
    let component = this.panelService.open<GameCharacterSheetComponent>(GameCharacterSheetComponent, option);
    component.tabletopObject = gameObject;
  }
  
  identify(index, gridInfo){
    return `${this.panelId}:${gridInfo.x}:${gridInfo.y}`;
  }
}