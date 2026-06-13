import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ObjectSerializer } from '@udonarium/core/synchronize-object/object-serializer';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem } from '@udonarium/core/system';
import { DiceRollTable } from '@udonarium/dice-roll-table';
import { DiceRollTableList } from '@udonarium/dice-roll-table-list';
import { TextViewComponent } from 'component/text-view/text-view.component';
import { ModalService } from 'service/modal.service';
import { PanelOption, PanelService } from 'service/panel.service';
import { PointerDeviceService } from 'service/pointer-device.service';
import { SaveDataService } from 'service/save-data.service';

@Component({
    selector: 'dice-roll-table-setting',
    templateUrl: './dice-roll-table-setting.component.html',
    styleUrls: ['./dice-roll-table-setting.component.css'],
    standalone: false
})
export class DiceRollTableSettingComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('diceRollTableSelecter') diceRollTableSelecter: ElementRef<HTMLSelectElement>;

  selectedDiceRollTable: DiceRollTable = null;
  selectedDiceRollTableXml: string = '';

  get diceRollTableName(): string { return this.selectedDiceRollTable.name; }
  set diceRollTableName(name: string) { if (this.isEditable) this.selectedDiceRollTable.name = name; }

  get diceRollTableDice(): string { return this.selectedDiceRollTable.dice; }
  set diceRollTableDice(dice: string) { if (this.isEditable) this.selectedDiceRollTable.dice = dice; }

  get diceRollTableCommand(): string { return this.selectedDiceRollTable.command; }
  set diceRollTableCommand(command: string) { if (this.isEditable) this.selectedDiceRollTable.command = command; }

  get diceRollTableText(): string { return <string>this.selectedDiceRollTable.value; }
  set diceRollTableText(text: string) { if (this.isEditable) this.selectedDiceRollTable.value = text; }

  get diceRollTables(): DiceRollTable[] { return DiceRollTableList.instance.children as DiceRollTable[]; }
  get isEmpty(): boolean { return this.diceRollTables.length < 1 }
  get isDeleted(): boolean { return this.selectedDiceRollTable ? ObjectStore.instance.get(this.selectedDiceRollTable.identifier) == null : false; }
  get isEditable(): boolean { return !this.isEmpty && !this.isDeleted; }

  isSaveing: boolean = false;
  progresPercent: number = 0;

  constructor(
    private pointerDeviceService: PointerDeviceService,
    private modalService: ModalService,
    private panelService: PanelService,
    private saveDataService: SaveDataService
  ) { }

  ngOnInit() {
    Promise.resolve().then(() => this.modalService.title = this.panelService.title = '骰子機器人表設定');
    EventSystem.register(this)
      .on('DELETE_GAME_OBJECT', 1000, event => {
        if (!this.selectedDiceRollTable || event.data.identifier !== this.selectedDiceRollTable.identifier) return;
        let object = ObjectStore.instance.get(event.data.identifier);
        if (object !== null) {
          this.selectedDiceRollTableXml = object.toXml();
        }
      });
  }

  ngAfterViewInit() {
    //const diceRollTables = DiceRollTableList.instance.diceRollTables;
    if (this.diceRollTables.length > 0) {
      queueMicrotask(() => {
        this.onChangeDiceRollTable(this.diceRollTables[0].identifier);
        this.diceRollTableSelecter.nativeElement.selectedIndex = 0;
      });
    }
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
  }

  onChangeDiceRollTable(identifier: string) {
    this.selectedDiceRollTable = ObjectStore.instance.get<DiceRollTable>(identifier);
    this.selectedDiceRollTableXml = '';
  }

  create(name: string = '骰子機器人表'): DiceRollTable {
    return DiceRollTableList.instance.addDiceRollTable(name)
  }

  add() {
    const diceRollTable = this.create();
    queueMicrotask(() => {
      this.onChangeDiceRollTable(diceRollTable.identifier);
      this.diceRollTableSelecter.nativeElement.value = diceRollTable.identifier;
    })
  }
  
  async save() {
    if (!this.selectedDiceRollTable || this.isSaveing) return;
    this.isSaveing = true;
    this.progresPercent = 0;

    let fileName: string = 'fly_rollTable_' + this.selectedDiceRollTable.name;

    await this.saveDataService.saveGameObjectAsync(this.selectedDiceRollTable, fileName, percent => {
      this.progresPercent = percent;
    });

    setTimeout(() => {
      this.isSaveing = false;
      this.progresPercent = 0;
    }, 500);
  }

  async saveAll() {
    if (this.isSaveing) return;
    this.isSaveing = true;
    this.progresPercent = 0;

    await this.saveDataService.saveGameObjectAsync(DiceRollTableList.instance, 'fly_rollTable_All', percent => {
      this.progresPercent = percent;
    });

    setTimeout(() => {
      this.isSaveing = false;
      this.progresPercent = 0;
    }, 500);
  }

  delete() {
    if (!this.isEmpty && this.selectedDiceRollTable) {
      this.selectedDiceRollTableXml = this.selectedDiceRollTable.toXml();
      this.selectedDiceRollTable.destroy();
    }
  }

  restore() {
    if (this.selectedDiceRollTable && this.selectedDiceRollTableXml) {
      let restoreTable = <DiceRollTable>ObjectSerializer.instance.parseXml(this.selectedDiceRollTableXml);
      DiceRollTableList.instance.addDiceRollTable(restoreTable);
      this.selectedDiceRollTableXml = '';
      queueMicrotask(() => {
        const diceRollTables = this.diceRollTables;
        this.onChangeDiceRollTable(diceRollTables[diceRollTables.length - 1].identifier);
        this.diceRollTableSelecter.nativeElement.selectedIndex = diceRollTables.length - 1;
      });
    }
  }

  upTabIndex() {
    if (!this.selectedDiceRollTable) return;
    let parentElement = this.selectedDiceRollTable.parent;
    let index: number = parentElement.children.indexOf(this.selectedDiceRollTable);
    if (0 < index) {
      let prevElement = parentElement.children[index - 1];
      parentElement.insertBefore(this.selectedDiceRollTable, prevElement);
    }
  }

  downTabIndex() {
    if (!this.selectedDiceRollTable) return;
    let parentElement = this.selectedDiceRollTable.parent;
    let index: number = parentElement.children.indexOf(this.selectedDiceRollTable);
    if (index < parentElement.children.length - 1) {
      let nextElement = parentElement.children[index + 1];
      parentElement.insertBefore(nextElement, this.selectedDiceRollTable);
    }
  }

  helpDiceRollTable() {
    let coordinate = this.pointerDeviceService.pointers[0];
    let option: PanelOption = { left: coordinate.x, top: coordinate.y, width: 600, height: 788 };
    let textView = this.panelService.open(TextViewComponent, option);
    textView.title = '骰子機器人表說明';
    textView.text = 
`　設定名稱、指令、要擲的骰子，以骰子數字參照表格並顯示結果。
　從聊天傳送指令，結果會如同骰子機器人一樣送出。
　表格每行以「:」（冒號）分隔數字與結果，格式為「數字:結果」（因此骰子必須最終回傳一個數字，也支援分開骰 nBm、個數累加骰 nRm、上方無限骰 nUm 的成功數）。
　
　也可用「-」（連字號）或「～」分隔來指定數字範圍。
　在表格中填入「\\n」可在該處換行（\\n 不會顯示）。

骰子機器人表範例）
　name: 遭遇艦種　
　command: ShipType　　dice: 1d6

　　1:戦艦
　　2:空母
　　3:重巡洋艦
　　4:軽巡洋艦
　　5-6:駆逐艦

　參照表格時以先出現的為優先，上述範例中最後一行寫成「1-6:駆逐艦」結果相同（但建議寫得清楚易懂）。
　預設的 D66 不排序，需要排序時（如骰骰子小說的名稱表等），請使用 D66S 取得排序後的數字。
　數字前可用「*」（星號）作為萬用牌（任意數字），例如「*-1」表示 1 以下，「6-*」表示 6 以上（單獨「*」為所有數字，以先出現者為優先，寫在表格中間時，其後的行將不被參照）。可透過後述的修正功能，使超出表格範圍的數字也能取得結果。

　從聊天傳送指令時，不區分全形/半形及英文大小寫。也可對骰子加減修正值，或用任意數字參照。在指令後填入「+修正值」或「-修正值」可修正擲出的數字；填入「=指定值」可用該數字參照對應的骰子機器人表。修正值、指定值為任意整數。

指令範例）
　ShipType=3
　用數字 3 指定參照前述「遭遇艦種」表，結果顯示「重巡洋艦」。若指定小於 1 或大於 6 的數字，將顯示「（無結果）」。

　ShipType+2
　以 1d6 結果加 2 的數字參照前述「遭遇艦種」表。「遭遇艦種」沒有 7 以後的記載，此時將顯示「（無結果）」，如需避免此情況，請使用前述的萬用牌 *。`;
  }
}