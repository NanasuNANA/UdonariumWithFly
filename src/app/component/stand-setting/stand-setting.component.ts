import { AfterViewInit, Component, ElementRef, Input, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { EventSystem } from '@udonarium/core/system';
import { PanelOption, PanelService } from 'service/panel.service';
import { DataElement } from '@udonarium/data-element';
import { GameCharacter } from '@udonarium/game-character';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { StandElementComponent } from 'component/stand-element/stand-element.component';
import { UUID } from '@udonarium/core/system/util/uuid';
import { PointerDeviceService } from 'service/pointer-device.service';
import { TextViewComponent } from 'component/text-view/text-view.component';
import { ObjectSerializer } from '@udonarium/core/synchronize-object/object-serializer';
import { ConfirmationComponent, ConfirmationType } from 'component/confirmation/confirmation.component';
import { ModalService } from 'service/modal.service';

@Component({
  selector: 'app-stand-setting',
  templateUrl: './stand-setting.component.html',
  styleUrls: ['./stand-setting.component.css']
})
export class StandSettingComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() character: GameCharacter = null;
　@ViewChildren(StandElementComponent) standElementComponents: QueryList<StandElementComponent>;

  panelId: string;
  standSettingXML = '';

  private _intervalId;
  private isSpeaking = false;

  constructor(
    private panelService: PanelService,
    private pointerDeviceService: PointerDeviceService,
    private modalService: ModalService
  ) { }

  get standElements(): DataElement[] {
    return this.character.standList.standElements;
  }

  get imageList(): ImageFile[] {
    if (!this.character) return [];
    let ret = [];
    let dupe = {};
    const tmp = this.character.imageDataElement.getElementsByName('imageIdentifier');
    const elements = tmp.concat(this.character.imageDataElement.getElementsByName('faceIcon'));
    for (let elm of elements) {
      if (dupe[elm.value]) continue;
      let file = this.imageElementToFile(elm);
      if (file) {
        dupe[elm.value] = true;
        ret.push(file);
      }
    }
    return ret;
  }

  get position(): number {
    if (!this.character || !this.character.standList) return 0;
    return this.character.standList.position;
  }

  set position(position: number) {
    if (!this.character || !this.character.standList) return;
    this.character.standList.position = position;
  }

  get height(): number {
    if (!this.character || !this.character.standList) return 0;
    return this.character.standList.height;
  }

  set height(height: number) {
    if (!this.character || !this.character.standList) return;
    this.character.standList.height = height;
  }

  get overviewIndex(): number {
    if (!this.character || !this.character.standList) return -1;
    return this.character.standList.overviewIndex;
  }

  set overviewIndex(overviewIndex: number) {
    if (!this.character || !this.character.standList) return;
    this.character.standList.overviewIndex = overviewIndex;
  }

  set isSortNameList(isSortNameList: boolean) {
    if (!this.character || !this.character.standList) return;
    this.character.standList.isSortNameList = isSortNameList;
  }

  get isSortNameList(): boolean {
    if (!this.character || !this.character.standList) return true;
    return this.character.standList.isSortNameList;
  }

  ngOnInit() {
    Promise.resolve().then(() => this.updatePanelTitle());
    EventSystem.register(this)
      .on('DELETE_GAME_OBJECT', -1000, event => {
        if (this.character && this.character.identifier === event.data.identifier) {
          this.panelService.close();
        }
      });
    this.panelId = UUID.generateUuid();
  }

  ngAfterViewInit() {
    this._intervalId = setInterval(() => {
      this.isSpeaking = !this.isSpeaking;
      this.standElementComponents.forEach(standElementComponent => {
        standElementComponent.isSpeaking = this.isSpeaking;
      });
    }, 3600);
  }

  ngOnDestroy() {
    clearInterval(this._intervalId)
    EventSystem.unregister(this);
  }

  updatePanelTitle() {
    this.panelService.title = this.character.name + ' 的立繪設定';
  }

  add() {
    this.character.standList.add(this.character.imageFile.identifier);
    this.standSettingXML = '';
  }

  delele(standElement: DataElement, index: number) {
    EventSystem.call('DELETE_STAND_IMAGE', {
      characterIdentifier: this.character.identifier,
      identifier: standElement.identifier
    });
    if (!this.character || !this.character.standList) return;
    this.modalService.open(ConfirmationComponent, {
      title: '刪除立繪設定', 
      text: '確定要刪除立繪設定嗎？',
      type: ConfirmationType.OK_CANCEL,
      materialIcon: 'person_off',
      action: () => {
        this.standSettingXML = standElement.toXml();
        let elm = this.character.standList.removeChild(standElement);
        if (elm) {
          if (this.character.standList.overviewIndex == index) {
            this.character.standList.overviewIndex = -1;
          } else if (this.character.standList.overviewIndex > index) {
            this.character.standList.overviewIndex -= 1;
          }
        }
      }
    });
  }
  
  restore() {
    if (!this.standSettingXML) return;
    let restoreStand = <DataElement>ObjectSerializer.instance.parseXml(this.standSettingXML);
    this.character.standList.appendChild(restoreStand);
    this.standSettingXML = '';
  }

  upStandIndex(standElement: DataElement) {
    this.standSettingXML = '';
    let parentElement = this.character.standList;
    let index: number = parentElement.children.indexOf(standElement);
    if (0 < index) {
      let prevElement = parentElement.children[index - 1];
      parentElement.insertBefore(standElement, prevElement);
      if (this.character.standList.overviewIndex == index) {
        this.character.standList.overviewIndex -= 1;
      } else if (this.character.standList.overviewIndex == index - 1) {
        this.character.standList.overviewIndex += 1;
      } 
    }
  }

  downStandIndex(standElement: DataElement) {
    this.standSettingXML = '';
    let parentElement = this.character.standList;
    let index: number = parentElement.children.indexOf(standElement);
    if (index < parentElement.children.length - 1) {
      let nextElement = parentElement.children[index + 1];
      parentElement.insertBefore(nextElement, standElement);
      if (this.character.standList.overviewIndex == index) {
        this.character.standList.overviewIndex += 1;
      } else if (this.character.standList.overviewIndex == index + 1) {
        this.character.standList.overviewIndex -= 1;
      } 
    }
  }

  helpStandSeteing() {
    let coordinate = this.pointerDeviceService.pointers[0];
    let option: PanelOption = { left: coordinate.x, top: coordinate.y, width: 600, height: 620 };
    let textView = this.panelService.open(TextViewComponent, option);
    textView.title = '立繪設定說明';
    textView.text = 
`　可設定立繪的名稱、位置與圖片高度（均以相對於畫面尺寸的比例指定），以及聊天送出時顯示立繪的觸發條件。

　立繪設定了名稱後，會顯示在聊天視窗和聊天面板的列表中供選擇。設定標籤時，即使是同一角色，不同標籤間也會有出場與退場的動畫。

　圖片的位置與高度可個別指定，位置個別指定未勾選、高度設為 0 時，使用整體設定。縱向位置調整（AdjY）以相對於立繪圖片高度的比例指定（例如設為 -50% 時，圖片下半部會隱藏到畫面邊緣以下）。

　條件的「指定圖片」為聊天送出時的角色圖片或大頭照 icon。另外，特殊條件「始終」：聊天文字末尾為「@退去」或「@farewell」時，該角色的立繪會退場。

　優先順序由高至低：

　　１. 「@退去」、「@farewell」退場
　　２. 在聊天視窗、聊天面板列表中選取的名稱
　　３. 「指定圖片 且 聊天末尾」
　　４. 「指定圖片 或 聊天末尾」
　　５. 「聊天末尾」
　　６. 「指定圖片」

　所有條件均不滿足時使用「預設」，同一優先順序有多個條件時隨機選擇一個。

　判斷聊天末尾一致時，不區分全形/半形及英文大小寫。為與其他使用 BCDice 的線上跑團工具相容，判斷聊天末尾一致時，兩側帶空格的「 ＞ 」和「 → 」視為相同。
　另外，以「@退去」、「@farewell」退場時，或設定了以「@」開頭條件（如「@笑い」）時，不論立繪是否有效或條件是否滿足，該角色送出時，符合條件的聊天文字末尾「@」之後的部分會被截斷。`;
  }

  private imageElementToFile(dataElm: DataElement): ImageFile {
    if (!dataElm) return null;
    return ImageStorage.instance.get(<string>dataElm.value);
  }
}
