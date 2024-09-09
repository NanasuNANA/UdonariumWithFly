import GameSystemClass from 'bcdice/lib/game_system';

import BCDiceLoader from './bcdice/bcdice-loader';
import { ChatMessage, ChatMessageContext } from './chat-message';
import { ChatTab } from './chat-tab';
import { SyncObject } from './core/synchronize-object/decorator';
import { GameObject } from './core/synchronize-object/game-object';
import { ObjectStore } from './core/synchronize-object/object-store';
import { EventSystem } from './core/system';
import { PromiseQueue } from './core/system/util/promise-queue';
import { StringUtil } from './core/system/util/string-util';
import { DataElement } from './data-element';
import { GameCharacter } from './game-character';
import { PeerCursor } from './peer-cursor';
import { StandConditionType } from './stand-list';
import { DiceRollTableList } from './dice-roll-table-list';

import { CutInList } from './cut-in-list';
import { ChatMessageService } from 'service/chat-message.service';

export interface DiceBotInfo {
  id: string;
  game: string;
  lang?: string;
  sort_key?: string;
}

export interface DiceBotInfosIndexed {
  index: string;
  infos: DiceBotInfo[];
}

interface DiceRollResult {
  id: string;
  result: string;
  isSecret: boolean;
  isDiceRollTable?: boolean;
  tableName?: string;
  isEmptyDice?: boolean;
  isSuccess?: boolean;
  isFailure?: boolean;
  isCritical?: boolean;
  isFumble?: boolean;
}

let loader: BCDiceLoader;
let queue: PromiseQueue = initializeDiceBotQueue();

@SyncObject('dice-bot')
export class DiceBot extends GameObject {
  //private static queue: PromiseQueue = DiceBot.initializeDiceBotQueue();
  //public static loader = new BCDiceLoader();

  public static apiUrl: string = null;
  public static apiVersion: number = 2;
  public static adminUrl: string = null;

  public static diceBotInfos: DiceBotInfo[] = [];
  public static diceBotInfosIndexed: DiceBotInfosIndexed[] = [];

  public static replaceData: [string, string, string?][] = [
    ['新クトゥルフ', 'シンクトウルフシンワTRPG', '新クトゥルフ神話TRPG'],
    ['クトゥルフ神話TRPG', 'クトウルフシンワTRPG', '(旧) クトゥルフ神話TRPG'],
    ['크툴루', '크툴루의 부름 6판', '크툴루의 부름 6판'],
    ['克蘇魯神話', '克蘇魯的呼喚 第六版', '克蘇魯的呼喚 第六版'],
    ['克蘇魯神話第7版', '克蘇魯的呼喚 第7版', '克蘇魯的呼喚 第七版'],
    ['ダブルクロス2nd,3rd', 'タフルクロス The 2nd Edition/The 3rd Edtion', 'ダブルクロス The 2nd Edition, The 3rd Edtion'],
    ['더블크로스2nd,3rd', '더블크로스 The 2nd Edition/The 3rd Edtion', '더블크로스 The 2nd Edition, The 3rd Edtion'],
    ['トーグ', 'トオク', 'トーグ（TORG）'],
    ['ワープス', 'ワアフス', 'WARPS'],
    ['トーグ1.5版', 'トオク1.5ハン', 'トーグ（TORG） 1.5版'],
    ['トーグ エタニティ', 'トオクエタニテイ', 'トーグ（TORG） エタニティ'],
    ['心衝想機TRPGアルトレイズ', 'シンシヨウソウキTRPGアルトレイス', '心衝想機TRPG アルトレイズ'],
    ['パラサイトブラッドRPG', 'ハラサイトフラツト', 'パラサイトブラッド'],
    ['犯罪活劇RPGバッドライフ', 'ハンサイカツケキRPGハツトライフ', '犯罪活劇RPGバッドライフ'],
    ['晃天のイルージオ', 'コウテンノイルウシオ', '晃天のイルージオ'],
    ['歯車の塔の探空士', 'ハクルマノトウノスカイノオツ', '歯車の塔の探空士'],
    ['在りて遍くオルガレイン', 'アリテアマネクオルカレイン', '在りて遍くオルガレイン'],
    ['Pathfinder', 'ハスフアインタアRPG', 'パスファインダーRPG'],
    ['真・女神転生TRPG　覚醒編', 'シンメカミテンセイTRPGカクセイヘン', '真・女神転生TRPG 覚醒篇'],
    ['真・女神転生TRPG　覚醒篇', 'シンメカミテンセイTRPGカクセイヘン', '真・女神転生TRPG 覚醒篇'],
    ['YearZeroEngine', 'イヤアセロエンシン', 'Year Zero Engine'],
    ['Year Zero Engine', 'イヤアセロエンシン', 'Year Zero Engine'],
    ['ADVANCED FIGHTING FANTASY 2nd Edition', 'アトハンストファイテインクファンタシイタイ2ハン', 'アドバンスト・ファイティング・ファンタジー 第2版'],
    //['Vampire: The Masquerade 5th Edition', 'ウアンハイアサマスカレエトタイ5ハン', 'ヴァンパイア：ザ・マスカレード 第5版'],
    ['ワールドオブダークネス', 'ワアルトオフタアクネス', 'ワールド・オブ・ダークネス'],
    ['モノトーン・ミュージアム', 'モノトオンミユウシアム', 'モノトーンミュージアム'],
    ['剣の街の異邦人TRPG', 'ツルキノマチノイホウシンTRPG'],
    ['壊れた世界のポストマン', 'コワレタセカイノホストマン', '壊れた世界のポストマン'],
    ['紫縞のリヴラドール', 'シシマノリフラトオル', '紫縞のリヴラドール'],
    ['SRS汎用(改造版)', 'スタンタアトRPGシステムオルタナテイフハン', 'SRS汎用 オルタナティヴ'],
    ['Standard RPG System', 'スタンタアトRPGシステム', 'スタンダードRPGシステム（SRS）'],
    ['スタンダードRPGシステム', 'スタンタアトRPGシステム', 'スタンダードRPGシステム（SRS）'],
    ['Record of Steam', 'レコオトオフスチイム', 'レコード・オブ・スチーム'],
    ['砂塵戦機アーガス2ndEdition', 'サシンセンキアアカス2', '砂塵戦機アーガス 2nd Edition'],
    ['FINAL FANTSY XIV TTRPG(English)', 'フアイナルファンタシイ14TTRPG', 'FINAL FANTSY XIV TTRPG (English)'],
    ['NJSLYRBATTLE', 'ニンシヤスレイヤアハトル'],
    ['詩片のアルセット', 'ウタカタノアルセツト'],
    ['Shared†Fantasia', 'シエアアトフアンタシア'],
    ['真・女神転生', 'シンメカミテンセイ'],
    ['女神転生', 'メカミテンセイ'],
    ['覚醒篇', 'カクセイヘン'],
    ['Chill', 'チル'],
    ['BBNTRPG', 'ヒイヒイエヌTRPG', 'BBNTRPG (ブラック・ブラック・ネットワークTRPG)'],
    ['TORG Eternity', 'トオクエタアニテイ'],
    ['ガープス', 'カアフス', 'ガープス（GURPS）'],
    ['ガープスフィルトウィズ', 'カアフスフイルトウイス', 'ガープス（GURPS） フィルトウィズ'],
    ['絶対隷奴', 'セツタイレイト'],
    ['セラフィザイン', 'セイシユンシツカンTRPGセラフイサイン', '青春疾患TRPG セラフィザイン'],
    ['RuneQuest：Roleplaying in Glorantha', 'ルウンクエスト4', 'RuneQuest: Roleplaying in Glorantha'],
    ['艦これ', 'カンコレ'],
    ['神我狩', 'カミカカリ'],
    ['鵺鏡', 'ヌエカカミ'],
    ['トーキョー', 'トオキヨウ'],
    ['Ｎ◎ＶＡ', 'ノウア'],
    ['初音ミク', 'ハツネミク'],
    ['朱の孤塔', 'アケノコトウ'],
    ['在りて遍く', 'アリテアマネク'],
    ['央華封神', 'オウカホウシン'],
    ['心衝想機', 'シンシヨウソウキ'],
    ['胎より想え', 'ハラヨリオモエ'],
    ['展爛会', 'テンランカイ'],
    ['壊れた', 'コワレタ'],
    ['比叡山', 'ヒエイサン'],
    ['世界樹', 'セカイシユ'],
    ['異邦人', 'イホウシン'],
    ['転攻生', 'テンコウセイ'],
    ['探空士', 'スカイノオツ'],
    ['剣の街', 'ツルキノマチ'],
    ['黒絢', 'コツケン'],
    ['紫縞', 'シシマ'],
    ['破界', 'ハカイ'],
    ['銀剣', 'キンケン'],
    ['東京', 'トウキヨウ'],
    ['片道', 'カタミチ'],
    ['勇者', 'ユウシヤ'],
    ['少女', 'シヨウシヨ'],
    ['真空', 'シンクウ'],
    ['学園', 'カクエン'],
    ['世界', 'セカイ'],
    ['青春', 'セイシユン'],
    ['疾患', 'シツカン'],
    ['迷宮', 'メイキユウ'],
    ['歯車', 'ハクルマ'],
    ['蒼天', 'ソウテン'],
    ['墜落', 'ツイラク'],
    ['特命', 'トクメイ'],
    ['晃天', 'コウテン'],
    ['叛逆', 'ハンキヤク'],
    ['犯罪', 'ハンサイ'],
    ['活劇', 'カツケキ'],
    ['碧空', 'ヘキクウ'],
    ['蓬莱', 'ホウライ'],
    ['冒険', 'ホウケン'],
    ['六門', 'ロクモン'],
    ['炎上', 'エンシヨウ'],
    ['無限', 'ムケン'],
    ['塔', 'トウ'],
    ['獣', 'ケモノ'],
    ['獸', 'ケモノ'],
    ['森', 'モリ'],
    ['&', 'アント'],
    ['＆', 'アント'],
    ['ヴァ', 'ハ'],
    ['ヴィ', 'ヒ'],
    ['ヴェ', 'ヘ'],
    ['ヴォ', 'ホ'],
    ['ヴ', 'フ'],
    ['ァ', 'ア'],
    ['ィ', 'イ'],
    ['ゥ', 'ウ'],
    ['ェ', 'エ'],
    ['ォ', 'オ'],
    ['ャ', 'ヤ'],
    ['ュ', 'ユ'],
    ['ョ', 'ヨ'],
    ['ッ', 'ツ'],
    ['ヲ', 'オ'],
    ['ガ', 'カ'],
    ['ギ', 'キ'],
    ['グ', 'ク'],
    ['ゲ', 'ケ'],
    ['ゴ', 'コ'],
    ['ザ', 'サ'],
    ['ジ', 'シ'],
    ['ズ', 'ス'],
    ['ゼ', 'セ'],
    ['ゾ', 'ソ'],
    ['ダ', 'タ'],
    ['ヂ', 'チ'],
    ['ヅ', 'ツ'],
    ['デ', 'テ'],
    ['ド', 'ト'],
    ['バ', 'ハ'],
    ['ビ', 'ヒ'],
    ['ブ', 'フ'],
    ['ベ', 'ヘ'],
    ['ボ', 'ホ'],
    ['パ', 'ハ'],
    ['ピ', 'ヒ'],
    ['プ', 'フ'],
    ['ペ', 'ヘ'],
    ['ポ', 'ホ']
  ];

  constructor(
    identifire,
    private chatMessageService: ChatMessageService = null
  ) { 
    super(identifire);
  }

  static async rollCommandAsync(diceCommand: string, gameType='DiceBot', isTableFormat=false): Promise<DiceRollResult> {
    //const text: string = StringUtil.toHalfWidth(diceCommand).replace("\u200b", ''); //ゼロ幅スペース削除
    const text: string = diceCommand.replace("\u200b", ''); //ゼロ幅スペース削除
    const regArray = /^(([sＳｓ][rＲｒ][eＥｅ][pＰｐ][eＥｅ][aＡａ][tＴｔ]|[rＲｒ][eＥｅ][pＰｐ][eＥｅ][aＡａ][tＴｔ]|[sＳｓ][rＲｒ][eＥｅ][pＰｐ]|[rＲｒ][eＥｅ][pＰｐ]|[sＳｓ][xＸｘ]|[xＸｘ])?([\d０-９]+)?[ 　]+)?([^\n]*)?/ig.exec(text);
    const repCommand =  StringUtil.toHalfWidth(regArray[2]);
    const isRepSecret = repCommand && StringUtil.toHalfWidth(repCommand).toUpperCase().indexOf('S') === 0;
    const repeat: number = (regArray[3] != null) ? Number(StringUtil.toHalfWidth(regArray[3])) : 1;
    let rollText: string = (regArray[4] != null) ? regArray[4] : text;
    let finalResult: DiceRollResult = { id: 'DiceBot', result: '', isSecret: false, isDiceRollTable: false, isEmptyDice: true,
      isSuccess: false, isFailure: true, isCritical: false, isFumble: false };

    if (!rollText || repeat <= 0) return finalResult;

    //ダイスボット表
    let isDiceRollTableMatch = false;
    for (const diceRollTable of DiceRollTableList.instance.diceRollTables) {
      if (diceRollTable.command == null) continue;
      let isSecret = false;
      let modifier = 0;
      let modStr = '';
      let isFixedRef = false;
      const commandStr = StringUtil.toHalfWidth(diceRollTable.command.replace(/[―ー—‐]/g, '-')).trim().toUpperCase();
      const rollTextStr = StringUtil.toHalfWidth(rollText.replace(/[―ー—‐]/g, '-')).trim().toUpperCase();
      if (rollTextStr.startsWith('S' + commandStr) && (!rollTextStr[('S' + commandStr).length] || /[ \=\+\-]/.test(rollTextStr.charAt(('S' + commandStr).length)))) {
        isDiceRollTableMatch = true;
        isSecret = true;
        if (rollTextStr[('S' + commandStr).length] && rollTextStr[('S' + commandStr).length] != ' ') modStr = rollTextStr.substring(('S' + commandStr).length);
      } else if (rollTextStr.startsWith(commandStr) && (!rollTextStr[commandStr.length] || /[ \=\+\-]/.test(rollTextStr.charAt(commandStr.length)))) {
        isDiceRollTableMatch = true;
        if (rollTextStr[commandStr.length] && rollTextStr[commandStr.length] != ' ') modStr = rollTextStr.substring(commandStr.length);
      }
      if (modStr) {
        modStr = modStr.split(' ')[0];
        if (/^[\+\-]\d+$/.test(modStr)) {
          modifier = +modStr;
          modStr = ` (修正${modStr})`;
        } else if (/^\=\-?\d+$/.test(modStr)) {
          isFixedRef = true;
        } else {
          isDiceRollTableMatch = false;
          continue;
        }
      }
      if (isDiceRollTableMatch) {
        finalResult.isFailure = false;
        finalResult.isDiceRollTable = true;
        finalResult.tableName = (diceRollTable.name && diceRollTable.name.length > 0) ? diceRollTable.name : '(無名のダイスボット表)';
        finalResult.isSecret = isSecret || isRepSecret;
        const diceRollTableRows = diceRollTable.parseText();
        for (let i = 0; i < repeat && i < 32; i++) {
          let rollResultNumber = null;
          let rollResult = await DiceBot.diceRollAsync(isFixedRef ? `C(${modStr.substring(1)})` : StringUtil.toHalfWidth(diceRollTable.dice).trim().replace(/[ⅮÐ]/g, 'D').replace(/\×/g, '*').replace(/\÷/g, '/').replace(/[―ー—‐]/g, '-'), 'DiceBot', 1);
          finalResult.isEmptyDice = finalResult.isEmptyDice && rollResult.isEmptyDice;
          let match = null;
          if (rollResult.result.length > 0 && (match = rollResult.result.match(/\s＞\s(?:成功数|計算結果)?(\-?\d+)$/))) {
            rollResultNumber = +match[1];
          }
          if (rollResult.result && isTableFormat) rollResult.result = this.formatRollResult(rollResult.result);
          let isRowMatch = false;
          if (rollResultNumber != null) {
            for (const diceRollTableRow of diceRollTableRows) {
              if ((diceRollTableRow.range.start === null || diceRollTableRow.range.start <= rollResultNumber + modifier)
                && (diceRollTableRow.range.end === null || rollResultNumber + modifier <= diceRollTableRow.range.end)) {
                if (isTableFormat) {
                  if (!isFixedRef) {
                    finalResult.result += (rollResult.result + modStr + (modStr ? ` → ${rollResultNumber + modifier}`: '') + "\n" + StringUtil.cr(diceRollTableRow.result));
                  } else {
                    finalResult.result += ('指定=' + rollResultNumber + "\n" + StringUtil.cr(diceRollTableRow.result));
                  }
                } else {
                  finalResult.result = (isFixedRef ? '指定=' : '') + rollResultNumber + (isFixedRef ? '' : modStr) + ' ＞ ' + diceRollTableRow.result;
                }
                isRowMatch = true;
                break;
              }
            }
          }
          if (!isRowMatch) {
            if (rollResultNumber == null) {
              finalResult.isFailure = true;
              finalResult.result += ('（エラー：ダイスロールから数字が取得できません）' + "\n" + '(結果なし)');
            } else if (!isFixedRef) {
              finalResult.result += (rollResult.result + modStr + (modStr ? ` → ${rollResultNumber + modifier}`: '') + "\n" + '(結果なし)');
            } else {
              finalResult.result += ('指定=' + rollResultNumber + "\n" + '(結果なし)');
            }
          }
          if (1 < repeat) finalResult.result += ` #${i + 1}`;
          if (i < repeat - 1) finalResult.result += "\n";
        }
        break;
      }
    }
    if (!isDiceRollTableMatch) {
      // スペース区切りのChoiceコマンドへの対応
      let isChoice = false;
      //ToDO バージョン調べる
      let choiceMatch;
      if (choiceMatch = /^([sＳｓ]?[cＣｃ][hＨｈ][oＯｏ][iＩｉ][cＣｃ][eＥｅ][\d０-９]*)([ 　]+|[\\￥][sｓ])([^\n]*)/ig.exec(rollText.trim())) {
        //if (choiceMatch[2] && choiceMatch[2] !== '' && !DiceRollTableList.instance.diceRollTables.map(diceRollTable => diceRollTable.command).some(command => command != null && command.trim().toUpperCase() === choiceMatch[1].toUpperCase())) {
          rollText = StringUtil.toHalfWidth(choiceMatch[1] + StringUtil.cr(choiceMatch[2])) ;
          if (choiceMatch[2] != null) {
            const choiceText = choiceMatch[3] != null ? choiceMatch[3] : '';
            if (/^\d+\-\d+|[a-z]\-[a-z]$/i.test(StringUtil.toHalfWidth(choiceText.replace(/[―ー—‐]/g, '-')).trim())) {
              rollText += StringUtil.toHalfWidth(choiceText.replace(/[―ー—‐]/g, '-')).trim();
            } else {
              rollText += (StringUtil.toHalfWidth(choiceText).trim() === '' ? choiceText : StringUtil.cr(choiceText)).trim().replace(/[　\s]+/g, ' ');
            }
          }
          isChoice = true;
        //}
      }
      if (!isChoice) {
        if ((choiceMatch = /^([sＳｓ]?[cＣｃ][hＨｈ][oＯｏ][iＩｉ][cＣｃ][eＥｅ][\d０-９]*[\[［])([^\]］]+)([\]］])/ig.exec(rollText.trim())) 
          || (choiceMatch = /^([sＳｓ]?[cＣｃ][hＨｈ][oＯｏ][iＩｉ][cＣｃ][eＥｅ][\d０-９]*[\(（])([^\)）]+)([\)）])/ig.exec(rollText.trim()))) {
          //if (!DiceRollTableList.instance.diceRollTables.map(diceRollTable => StringUtil.toHalfWidth(diceRollTable.command).trim().toUpperCase()).some(command => command === StringUtil.toHalfWidth(choiceMatch[1]).trim().toUpperCase())) {
            //console.log(choiceMatch);
            const choiceText = choiceMatch[2] != null ? choiceMatch[2] : '';
            if (/^\d+\-\d+|[a-z]\-[a-z]$/i.test(StringUtil.toHalfWidth(choiceText.replace(/[―ー—‐]/g, '-')).trim())) {
              rollText = StringUtil.toHalfWidth(choiceMatch[1]) + StringUtil.toHalfWidth(choiceText.replace(/[―ー—‐]/g, '-')).trim() + StringUtil.toHalfWidth(choiceMatch[3]);
            } else {
              rollText = StringUtil.toHalfWidth(choiceMatch[1]) + choiceText.replace(/，/g, ',') + StringUtil.toHalfWidth(choiceMatch[3]);
            }
            isChoice = true;
          //}
        }
      }
      if (!isChoice) {
        rollText = StringUtil.toHalfWidth(rollText).trim().split(/\s+/)[0].replace(/[ⅮÐ]/g, 'D').replace(/\×/g, '*').replace(/\÷/g, '/').replace(/[―ー—‐]/g, '-');
      }
      //console.log(rollText);
      if (DiceBot.apiUrl) {
        //rollText = StringUtil.toHalfWidth(rollText).trim().split(/\s+/)[0].replace(/[ⅮÐ]/g, 'D').replace(/\×/g, '*').replace(/\÷/g, '/').replace(/[―ー—‐]/g, '-');
        // すべてBCDiceに投げずに回数が1回未満かchoice[]が含まれるか英数記号以外は門前払い
        //ToDO APIのバージョン調べて新しければCOMMAND_PATTERN使う？（いつ読み込もう？）
        if (!isChoice && !/^[a-zA-Z0-9!-/:-@¥[-`{-~\}]+$/.test(rollText)) return;
        //BCDice-API の繰り返し機能を利用する、結果の形式が縦に長いのと、更新していないBCDice-APIサーバーもありそうなのでまだ実装しない
        //finalResult = await DiceBot.diceRollAsync(repCommand ? (repCommand + repeat + ' ' + rollText) : rollText, gameType, repCommand ? 1 : repeat);
        finalResult = await DiceBot.diceRollAsync(rollText, gameType, repeat);
        finalResult.isSecret = finalResult.isSecret || isRepSecret;
      } else {
        // 読み込まれていないダイスボットのロード、COMMAND_PATTERN使用
        const gameSystem = await DiceBot.loadGameSystemAsync(gameType);
        if (!gameSystem.COMMAND_PATTERN.test(rollText)) return;
        for (let i = 0; i < repeat && i < 32; i++) {
          let rollResult = await DiceBot.diceRollAsync(rollText, gameType, repeat);
          if (rollResult.result.length < 1) break;
          finalResult.id = rollResult.id;
          finalResult.result += rollResult.result;
          finalResult.isSecret = finalResult.isSecret || rollResult.isSecret || isRepSecret;
          finalResult.isEmptyDice = finalResult.isEmptyDice && rollResult.isEmptyDice;
          finalResult.isSuccess = finalResult.isSuccess || rollResult.isSuccess;
          finalResult.isFailure = finalResult.isFailure && rollResult.isFailure;
          finalResult.isCritical = finalResult.isCritical || rollResult.isCritical;
          finalResult.isFumble = finalResult.isFumble || rollResult.isFumble;
          if (1 < repeat) finalResult.result += ` #${i + 1}\n`;
        }
      }
    }
    if (finalResult.result) finalResult.result = finalResult.result.trimRight();;
    return finalResult;
  }
  //static diceBotInfos: GameSystemInfo[] = [];

  // GameObject Lifecycle
  onStoreAdded() {
    super.onStoreAdded();
    EventSystem.register(this)
      .on('SEND_MESSAGE', async event => {
        const chatMessage = ObjectStore.instance.get<ChatMessage>(event.data.messageIdentifier);
        if (!chatMessage || !chatMessage.isSendFromSelf || chatMessage.isSystem || chatMessage.isOperationLog) return;
        let gameType: string = chatMessage.tag.replace('noface', '').trim();
        gameType = gameType ? gameType : 'DiceBot';
        try {
          const finalResult = await DiceBot.rollCommandAsync(chatMessage.text, gameType, true);
          if (!finalResult || !finalResult.result) return;
          this.sendResultMessage(finalResult, chatMessage);
        } catch (e) {
          console.error(e);
        }
        return;
      });
  }

  // GameObject Lifecycle
  onStoreRemoved() {
    super.onStoreRemoved();
    EventSystem.unregister(this);
  }

  private sendResultMessage(rollResult: DiceRollResult, originalMessage: ChatMessage) {
    let id: string = rollResult.id.split(':')[0];
    let result: string = rollResult.result;
    const isSecret: boolean = rollResult.isSecret;
    const isEmptyDice: boolean = rollResult.isEmptyDice;
    const isSuccess: boolean = rollResult.isSuccess;
    const isFailure: boolean = rollResult.isFailure;
    const isCritical: boolean = rollResult.isCritical;
    const isFumble: boolean = rollResult.isFumble;

    if (result.length < 1) return;
    //if (!rollResult.isDiceRollTable) result = DiceBot.formatRollResult(result, id);

    let tag = 'system';
    if (isSecret) tag += ' secret';
    if (isEmptyDice) tag += ' empty';
    if (isSuccess) tag += ' success';
    if (isFailure) tag += ' failure';
    if (isCritical) tag += ' critical';
    if (isFumble) tag += ' fumble';

    let diceBotMessage: ChatMessageContext = {
      identifier: '',
      tabIdentifier: originalMessage.tabIdentifier,
      originFrom: originalMessage.from,
      from: rollResult.isDiceRollTable ? 'Dice-Roll Table' : DiceBot.apiUrl ? `BCDice-API(${DiceBot.apiUrl})` : 'System-BCDice',
      timestamp: originalMessage.timestamp + 1,
      imageIdentifier: '',
      tag: tag,
      //name: rollResult.isDiceRollTable ?
      //  isSecret ? '<' + rollResult.tableName + ' (Secret)：' + originalMessage.name + '>' : '<' + rollResult.tableName + '：' + originalMessage.name + '>' :
      //  isSecret ? '<Secret-BCDice：' + originalMessage.name + '>' : '<BCDice：' + originalMessage.name + '>' ,
      name: `${rollResult.isDiceRollTable ? rollResult.tableName : id} : ${originalMessage.name}${isSecret ? ' (Secret)' : ''}`,
      text: result,
      color: originalMessage.color,
      isUseStandImage: originalMessage.isUseStandImage
    };

    let matchMostLongText = '';
    // ダイスボットへのスタンドの反応
    const gameCharacter = ObjectStore.instance.get(originalMessage.characterIdentifier);
    if (gameCharacter instanceof GameCharacter) {
      const standInfo = gameCharacter.standList.matchStandInfo(result, originalMessage.imageIdentifier);
      if (!isSecret && !originalMessage.standName && originalMessage.isUseStandImage) {
        if (standInfo.farewell) {
          const sendObj = {
            characterIdentifier: gameCharacter.identifier
          };
          if (originalMessage.to) {
            const targetPeer = PeerCursor.findByUserId(originalMessage.to);
            if (targetPeer) {
              if (targetPeer.peerId != PeerCursor.myCursor.peerId) EventSystem.call('FAREWELL_STAND_IMAGE', sendObj, targetPeer.peerId);
              EventSystem.call('FAREWELL_STAND_IMAGE', sendObj, PeerCursor.myCursor.peerId);
            }
          } else {
            EventSystem.call('FAREWELL_STAND_IMAGE', sendObj);
          }
        } else if (standInfo && standInfo.standElementIdentifier) {
          const diceBotMatch = <DataElement>ObjectStore.instance.get(standInfo.standElementIdentifier);
          if (diceBotMatch && diceBotMatch.getFirstElementByName('conditionType')) {
            const conditionType = +diceBotMatch.getFirstElementByName('conditionType').value;
            if (conditionType == StandConditionType.Postfix || conditionType == StandConditionType.PostfixOrImage || conditionType == StandConditionType.PostfixAndImage) {
              const sendObj = {
                characterIdentifier: gameCharacter.identifier,
                standIdentifier: standInfo.standElementIdentifier,
                color: originalMessage.color,
                secret: originalMessage.to ? true : false
              };
              if (sendObj.secret) {
                const targetPeer = PeerCursor.findByUserId(originalMessage.to);
                if (targetPeer) {
                  if (targetPeer.peerId != PeerCursor.myCursor.peerId) EventSystem.call('POPUP_STAND_IMAGE', sendObj, targetPeer.peerId);
                  EventSystem.call('POPUP_STAND_IMAGE', sendObj, PeerCursor.myCursor.peerId);
                }
              } else {
                EventSystem.call('POPUP_STAND_IMAGE', sendObj);
              }
            }
          }
        }
      }
      matchMostLongText = standInfo.matchMostLongText;
    }

    const chatTab = ObjectStore.instance.get<ChatTab>(originalMessage.tabIdentifier);
    // ダイスによるカットイン発生
    const cutInInfo = CutInList.instance.matchCutInInfo(result);
    if (!isSecret && chatTab.isUseStandImage && cutInInfo) {
      for (const identifier of cutInInfo.identifiers) {
        const sendObj = {
          identifier: identifier,
          secret: originalMessage.to ? true : false,
          sender: PeerCursor.myCursor.peerId
        };
        if (sendObj.secret) {
          const targetPeer = PeerCursor.findByUserId(originalMessage.to);
          if (targetPeer) {
            if (targetPeer.peerId != PeerCursor.myCursor.peerId) EventSystem.call('PLAY_CUT_IN', sendObj, targetPeer.peerId);
            EventSystem.call('PLAY_CUT_IN', sendObj, PeerCursor.myCursor.peerId);
          }
        } else {
          EventSystem.call('PLAY_CUT_IN', sendObj);
        }
      }
      if (cutInInfo.names && cutInInfo.names.length && !originalMessage.to && this.chatMessageService) {
        const counter = new Map();
        for (const name of cutInInfo.names) {
          let count = counter.get(name) || 0;
          count += 1;
          counter.set(name == '' ? '(無名のカットイン)' : name, count);
        }
        const text = `${[...counter.keys()].map(key => counter.get(key) > 1 ? `${key}×${counter.get(key)}` : key).join('、')}`;
        this.chatMessageService.sendOperationLog(text + ' が起動した');
      }
    }

    // 切り取り
    if (matchMostLongText.length < cutInInfo.matchMostLongText.length) matchMostLongText = cutInInfo.matchMostLongText;
    if (matchMostLongText && diceBotMessage.text) {
      diceBotMessage.text = diceBotMessage.text.slice(0, diceBotMessage.text.length - matchMostLongText.length);
    }
    // フォーマット
    if (!rollResult.isDiceRollTable) diceBotMessage.text = DiceBot.formatRollResult(diceBotMessage.text, id);

    if (originalMessage.to != null && 0 < originalMessage.to.length) {
      diceBotMessage.to = originalMessage.to;
      if (originalMessage.to.indexOf(originalMessage.from) < 0) {
        diceBotMessage.to += ' ' + originalMessage.from;
      }
    }
    if (chatTab) chatTab.addMessage(diceBotMessage);
  }

  static async diceRollAsync(message: string, gameType: string, repeat: number = 1): Promise<DiceRollResult> {
    gameType = gameType ? gameType : 'DiceBot';
    if (DiceBot.apiUrl) {
      const request = DiceBot.apiVersion == 1
        ? DiceBot.apiUrl + '/v1/diceroll?system=' + (gameType ? encodeURIComponent(gameType) : 'DiceBot') + '&command=' + encodeURIComponent(message)
        : `${DiceBot.apiUrl}/v2/game_system/${(gameType ? encodeURIComponent(gameType) : 'DiceBot')}/roll?command=${encodeURIComponent(message)}`;
      const promisise = [];
      for (let i = 1; i <= repeat; i++) {
        promisise.push(
          fetch(request, {mode: 'cors'})
            .then(response => {
              if (response.ok) {
                return response.json();
              }
              throw new Error(response.statusText);
            })
            .then(json => {
              //console.log(JSON.stringify(json))
              return { id: gameType, result: (DiceBot.apiVersion == 1 ? json.result : json.text) + (repeat > 1 ? ` #${i}\n` : ''), isSecret: json.secret,
                isEmptyDice: DiceBot.apiVersion == 1 ? (json.dices && json.dices.length == 0) : (json.rands && json.rands.length == 0),
                isSuccess: json.success, isFailure: json.failure, isCritical: json.critical, isFumble: json.fumble };
            })
            .catch(e => {
              //console.error(e);
              return { id: gameType, result: '', isSecret: false,  isEmptyDice: true };
            })
        );
      }
      return Promise.all(promisise)
        .then(results => { return results.reduce((ac, cv) => {
          let result = ac.result + cv.result;
          let isSecret = ac.isSecret || cv.isSecret;
          let isEmptyDice = ac.isEmptyDice && cv.isEmptyDice;
          let isSuccess = ac.isSuccess || cv.isSuccess;
          let isFailure = ac.isFailure && cv.isFailure;
          let isCritical = ac.isCritical || cv.isCritical;
          let isFumble = ac.isFumble || cv.isFumble;
          return { id: gameType, result, isSecret: isSecret, isEmptyDice: isEmptyDice,
            isSuccess: isSuccess, isFailure: isFailure, isCritical: isCritical, isFumble: isFumble };
        }, { id: gameType, result: '', isSecret: false, isEmptyDice: true, isSuccess: false, isFailure: true, isCritical: false, isFumble: false }) });
    } else {
      try {
        let gameSystem = await DiceBot.loadGameSystemAsync(gameType);
        const result = gameSystem.eval(message);
        if (!result) return { id: gameType, result: '', isSecret: false, isEmptyDice: true };
        console.log('diceRoll!!!', result);
        console.log('isSecret!!!', result.secret);
        console.log('isEmptyDice!!!', !result.rands || result.rands.length == 0);
        return { id: gameSystem.ID, result: result.text, isSecret: result.secret, isEmptyDice: !result.rands || result.rands.length == 0,
          isSuccess: result.success, isFailure: result.failure, isCritical: result.critical, isFumble: result.fumble };
      } catch (e) {
        console.error(e);
      }
      return { id: gameType, result: '', isSecret: false, isEmptyDice: true };
    }
  }

  static async getHelpMessage(gameType: string): Promise<string|string[]> {
    gameType = gameType ? gameType : 'DiceBot';
    if (DiceBot.apiUrl) {
      const promisise = [
        fetch(DiceBot.apiVersion == 1 ? DiceBot.apiUrl + '/v1/systeminfo?system=DiceBot' : `${DiceBot.apiUrl}/v2/game_system/DiceBot`, {mode: 'cors'})
          .then(response => { return response.json() })
      ];
      if (gameType && gameType != 'DiceBot') {
        promisise.push(
          fetch(DiceBot.apiVersion == 1 ? DiceBot.apiUrl + '/v1/systeminfo?system=' + encodeURIComponent(gameType) : `${DiceBot.apiUrl}/v2/game_system/${encodeURIComponent(gameType)}`, {mode: 'cors'})
            .then(response => { return response.json() })
        );
      }
      return Promise.all(promisise)
        .then(jsons => {
          return jsons.map(json => {
            if (DiceBot.apiVersion == 1 && json.systeminfo && json.systeminfo.info) {
              return json.systeminfo.info.replace('部屋のシステム名', 'チャットパレットなどのシステム名');
            } else if (json.help_message) {
              return json.help_message.replace('部屋のシステム名', 'チャットパレットなどのシステム名');
            } else {
              return 'ダイスボット情報がありません。';
            }
          })
        });
    } else {
      let help = [''];
      try {
        help = [(await DiceBot.loadGameSystemAsync('DiceBot')).HELP_MESSAGE];
        if (gameType && gameType != '' && gameType != 'DiceBot') {
          let gameSystem = await DiceBot.loadGameSystemAsync(gameType);
          if (gameSystem && gameSystem.ID != 'DiceBot' && gameSystem.HELP_MESSAGE) {
            help.push(gameSystem.HELP_MESSAGE.replace('部屋のシステム名', 'チャットパレットなどのシステム名'));
          } else {
            help.push('ダイスボット情報がありません。');
          }
        }
      } catch (e) {
        console.error(e);
      }
      return help;
    }
  }

  static async loadGameSystemAsync(gameType: string): Promise<GameSystemClass> {
    return await queue.add(() => {
      const id = this.diceBotInfos.some(info => info.id === gameType) ? gameType : 'DiceBot';
      try {
        return loader.getGameSystemClass(id);
      } catch {
        return loader.dynamicLoad(id);
      }
    });
  }

  private static formatRollResult(result: string, id='DiceBot'): string {
    if (result == null) return '';
    let coc7thFARCount = 0; //ToDo CoC他ゲームごとの処理メソッド分離
    let coc7thBonusDiceCount = 0; //ToDo CoC他ゲームごとの処理メソッド分離
    return result.split("\n").map(resultLine => {
      let addDiceInfos = [];
      let barabaraDiceInfos = [];
      let rerollDiceInfos = [];
      let upperDiceInfos = [];
      if (id === 'Cthulhu7th' && /^\d+(:?回目|次|번째): ＞/.test(resultLine)) {
        coc7thFARCount += 1;
        resultLine = '🎲' + resultLine;
      } 
      return resultLine.split(/\s＞\s/).map((resultFragment, i, a) => {
        let matchBonusDiceCount = null;
        if (id === 'Cthulhu7th' && (matchBonusDiceCount = /(?:ボーナス・ペナルティダイス|獎勵、懲罰骰値|보너스, 패널티 주사위)\[(?<bonusDice>\-?\d+)\]/.exec(resultFragment))) {
          if (matchBonusDiceCount && matchBonusDiceCount.groups) coc7thBonusDiceCount = +matchBonusDiceCount.groups['bonusDice'];
        }
        if (a.length === 1) return resultFragment;
        if (i == 0) {
          if ((id === 'Cthulhu' && /\d\) (?:故障ナンバー|故障率|고장넘버)\[\-?\d+\]/.test(resultFragment))
            || (id === 'Cthulhu7th' && /\d\) (?:ボーナス・ペナルティダイス|獎勵、懲罰骰値|보너스, 패널티 주사위)\[\-?\d+\]/.test(resultFragment))
          ) {
            return '🎲' + resultFragment.replace(/\((1D100<=\d+)\) /i, '$1 ');
          }
          const regExp1 = (DiceBot.apiUrl && DiceBot.apiVersion == 1) ? /^(?:\: )\(([A-Z\d\+\-\*\/=\(\),\[\]\<\>@#\$\?]+)\)$/i : /^\(([A-Z\d\+\-\*\/=\(\),\[\]\<\>@#\$\?]+)\)$/i;
          const regExp2 = (DiceBot.apiUrl && DiceBot.apiVersion == 1) ? /^(?:\: )\((CHOICE(?:\d+)?[\[\( ].+)\)$/i : /^\((CHOICE(?:\d+)?[\[\( ].+)\)$/i;
          const parentheses = resultFragment.match(regExp1) || resultFragment.match(regExp2);
          if (parentheses && !parentheses[1].toUpperCase().startsWith('CHOICE')) {
            addDiceInfos = [...resultFragment.matchAll(/(?<diceCount>\d+)D\d+(?:(?<keepDrop>[KD][HL])(?<keepDropCount>\d+))?/gi)];
            if (!addDiceInfos.length) {
              barabaraDiceInfos = [...resultFragment.matchAll(/\d+B\d+(?:\+\d+B\d+)*(?:\[6\]Limit\[\d+\])?(?<sign><=|>=|<>|==|!=|<|>|=)(?<criteria>\d+)/gi)];
              if (!barabaraDiceInfos.length) {
                rerollDiceInfos = [...resultFragment.matchAll(/\d+R\d+(?:\+\d+R\d+)*\[(?<rerollSign><=|>=|<>|==|!=|<|>|=)?(?<rerollCriteria>\d+)\](?:(?<sign><=|>=|<>|==|!=|<|>|=)(?<criteria>\d+))?/gi)];
                if (!rerollDiceInfos.length) {
                  upperDiceInfos = [...resultFragment.matchAll(/\d+U\d+(?:\+\d+U\d+)*\[(?<rerollCriteria>\d+)\](?<modifier>[\-+]\d+)?(?:(?<sign><=|>=|<>|==|!=|<|>|=)(?<criteria>\d+))?/gi)];
                }
              }
            }
          }
          return parentheses ? '🎲' + parentheses[1] : resultFragment;
        } else if (i == (a.length - 1)) {
          return resultFragment;
        } else if (i == 1 && (addDiceInfos.length || barabaraDiceInfos.length || rerollDiceInfos.length || upperDiceInfos.length)) {
          try {
            let tmpString = resultFragment;
            const diceArrayRegExp = addDiceInfos.length ? /(?<total>\d+)\[(?<diceArrayString>\d+(?:,\d+)*)?\]/gi
              : upperDiceInfos.length ? /(?:(?<total>\d+)\[(?<diceArrayString>\d+(?:,\d+)*)?\])|(?<modifier2>[\-+]\d+)|(?<dieString>\d+)/gi
              : /(?<diceArrayString>\d+(?:,\d+)*)/gi;
            const diceArrayInfos = [...resultFragment.matchAll(diceArrayRegExp)];
            if (diceArrayInfos.length) {
              let placePointOffset = 0;
              let placeString;
              diceArrayInfos.forEach((diceArrayInfo, j) => {
                placeString = diceArrayInfo[0];
                if (addDiceInfos.length) {
                  const {diceCount, keepDrop, keepDropCount} = addDiceInfos[j].groups;
                  const {total, diceArrayString} = diceArrayInfo.groups;
                  if (keepDrop) {
                    const dice_ary = diceArrayString != null ? diceArrayString.split(',').sort((a, b) => (+a) - (+b)) : [];
                    const keep_count = keepDrop.startsWith('K') ? keepDropCount : (diceCount - keepDropCount);
                    if (keepDrop === 'KH' || keepDrop === 'DL') dice_ary.reverse();
                    const dice_ary_place = dice_ary.map((die, k) => (k + 1) <= keep_count ? `${die}` : `~~~${die}~~~`);
                    if (keepDrop === 'DH' || keepDrop === 'DL') dice_ary_place.reverse();
                    placeString = `${total}[${ dice_ary_place.join(',') }]`;
                  }
                } else if (barabaraDiceInfos.length) {
                  const {sign, criteria} = barabaraDiceInfos[0].groups;
                  const {diceArrayString} = diceArrayInfo.groups;
                  placeString = diceArrayString.split(',').map(die => DiceBot.isPass(die, sign, criteria) ? `${die}` : `~~~${die}~~~`).join(',');
                } else if (rerollDiceInfos.length) {
                  let {rerollSign, rerollCriteria, sign, criteria} = rerollDiceInfos[0].groups;
                  if (!rerollSign) rerollSign = sign;
                  if (!rerollCriteria) rerollCriteria = criteria;
                  const {diceArrayString} = diceArrayInfo.groups;
                  //console.log(rerollDiceInfos[0], dice_ary_str)
                  placeString = diceArrayString.split(',')
                    .map(die => DiceBot.isPass(die, rerollSign, rerollCriteria) ? `###${die}###` : die)
                    .map(die => DiceBot.isPass(die, sign, criteria, false) ? die : `~~~${die}~~~`)
                    .join(',');
                } else if (upperDiceInfos.length) {
                  const {rerollCriteria, modifier, sign, criteria} = upperDiceInfos[0].groups;
                  const {total, diceArrayString, modifier2, dieString} = diceArrayInfo.groups;
                  console.log(upperDiceInfos[0], diceArrayInfo)
                  if (modifier2) {
                    placeString = ` (${modifier2})`;
                  } else {
                    if (total) {
                      placeString = total + '[' + diceArrayString.split(',')
                      .map(die => DiceBot.isPass(die, '>=', rerollCriteria) ? `###${die}###` : die)
                      .join(',') + ']';
                      if (!DiceBot.isPass((+total) + (modifier ? +modifier : 0), sign, criteria)) placeString = `~~~${placeString}~~~`;
                    } else {
                      let tmp = placeString;
                      placeString = DiceBot.isPass(dieString, '>=', rerollCriteria) ? `###${dieString}###` : dieString;
                      if (!DiceBot.isPass((+tmp) + (modifier ? +modifier : 0), sign, criteria)) placeString = `~~~${placeString}~~~`;
                    }
                  }
                }
                const placePoint = tmpString.indexOf(diceArrayInfo[0], placePointOffset);
                if (placeString != diceArrayInfo[0]) tmpString = tmpString.substring(0, placePoint) + placeString + tmpString.substring(placePoint + diceArrayInfo[0].length);
                placePointOffset = placePoint + placeString.length;
              });
            }
            resultFragment = tmpString;
          } catch(e) {
            console.error(e);
          }
        } else if (id == 'BladeOfArcana' && (i == 1 || i == 2)) {
          const match = a[0].match(/^\(\d+A(?<deficult>\d+)C(?<critical>\d+)F(?<fumble>\d+)\)$/i);
          if (match) {
            const {deficult, critical, fumble} = match.groups;
            resultFragment = resultFragment.split(',').map(diceStr => {
              let diceNum = parseInt(diceStr.trim());
              if (diceNum === 1) {
                return `###${diceNum}###`;
              } else if (diceNum >= parseInt(fumble)) {
                return `~~~###${diceNum}###~~~`;
              } else if (diceNum <= parseInt(critical)) {
                return `###${diceNum}###`;
              } else if (diceNum > parseInt(deficult)) {
                return `~~~${diceNum}~~~`;
              }
              return diceStr;
            }).join(',');
          }
        } else if (id == 'Cthulhu7th' && (i == 1 || i == 2)) {
          console.log(resultFragment)
          resultFragment = resultFragment.replace(/(?:\d+, )*\d+/, diceAry => {
            const isBonus = (coc7thBonusDiceCount - (coc7thFARCount > 0 ? (coc7thFARCount - 1) : 0) >= 0);
            let minMax = (isBonus ? 101 : -1);
            const diceNumbers = diceAry.split(',').map(str => {
              let num = +str.trim();
              if (isBonus && minMax > num) minMax = num;
              if (!isBonus && minMax < num) minMax = num;
              return num;
            });
            let isOpt = true;
            return diceNumbers.map(num => {
              let numStr = num == 1 ? `###${num}###` : num.toString();
              if (diceNumbers.length > 1) {
                if (isOpt && num == minMax) {
                  isOpt = false;
                } else {
                  numStr = `~~~${numStr}~~~`
                }
              }
              return numStr;
            }).join(', ');
          });
        } else if (id == 'DoubleCross' && i == 1) {
          resultFragment = resultFragment.split('+').map((flagment) => {
            const match1 = flagment.match(/(?<result>\d{1,2})\[(?<diceArrayString>\d{1,2}(?:,\d{1,2})*)\]/);
            if (match1) {
              const match2 = a[0].match(/\(\d+DX(?<critical>\d+)/i);
              if (match2) {
                const {result, diceArrayString} = match1.groups;
                const {critical} = match2.groups;
                let isCritical = false;
                const formatedDiceArrayString = diceArrayString.split(',').map((num, i, a) => {
                  if (parseInt(num) >= parseInt(critical)) {
                    isCritical = true;
                    return `###${num}###`;
                  } else {
                    return (i === a.length - 1) ? `${num}` : `~~~${num}~~~`;
                  }
                }).join(',');
                return `${ (isCritical ? `###${result}###` : result) }[${formatedDiceArrayString}]`;
              }
            }
            return flagment;
          }).join('+');
        } else if (id == 'DungeonsAndDragons5' && i == 1 && (a[0].startsWith('(AT') || a[0].startsWith('(AR'))) {
          const isAttackRoll = a[0].startsWith('(AT');
          const isAdvantage = a[0].endsWith('A)');
          const isDisadvantage = a[0].endsWith('D)');
          if (isAdvantage || isDisadvantage) {
            const match = resultFragment.match(/\[(?<diceArrayString>\d+(?:,\d+)*)?\](?<modifier>[\-+]\d+)?/i);
            if (!match) return resultFragment;
            const {diceArrayString, modifier} = match.groups;
            const numbers = diceArrayString.split(',').map(n => parseInt(n));
            const liveNumber = isAdvantage ? Math.max(...numbers) : Math.min(...numbers);
            let isDone = false;
            resultFragment = '[' + numbers.map(n => {
                let palceString = (isAttackRoll && (n === 20 || n === 1)) ? `###${n}###` : n.toString();
                if (!isDone && n === liveNumber) {
                  isDone = true;
                } else {
                  palceString = `~~~${palceString}~~~`;
                }
                return palceString;
              }).join(',') + ']' + (modifier ? modifier : '');
          } else if (isAttackRoll) {
            const match = resultFragment.match(/(?<diceString>\d+)?(?<modifier>[\-+]\d+)?/i);
            if (match) {
              const {diceString, modifier} = match.groups;
              if (diceString && (parseInt(diceString) === 20 || parseInt(diceString) === 1)) resultFragment = `###${diceString}###${modifier ? modifier : ''}`;
            }
          }
        }
        return resultFragment;
      }).join(' ＞ ').replace(/(\s|^)＞\s/g, '$1→ ').replace(/\((\d+)(D)(\d+)＞(\d)/ig, '(🎲$1$2$3→$4');
    }).join("\n");
  }

  private static isPass(num: string|number, sign: string, criteria: string|number, _default=true): boolean {
    if (num == null) return _default;
    let match = num.toString().match(/(\d+)/);
    if (match) num = match[1];
    let isPass = _default;
    switch (sign) {
      case '==':
      case '=':
        isPass = (+num == +criteria);
        break;
      case '!=':
      case '<>':
        isPass = (+num != +criteria);
        break;
      case '>=':
        isPass = (+num >= +criteria);
        break;
      case '<=':
        isPass = (+num <= +criteria);
        break;
      case '<':
        isPass = (+num < +criteria);
        break;
      case '>':
        isPass = (+num > +criteria);
        break;
    }
    return isPass;
  }
/*
  function initializeDiceBotQueue(): PromiseQueue {
    let queue = new PromiseQueue('DiceBotQueue');
    queue.add(async () => {
      loader = new (await import(
        
        './bcdice/bcdice-loader')
      ).default();
      DiceBot.diceBotInfos = loader.listAvailableGameSystems()
        .sort((a, b) => {
          if (a.sortKey < b.sortKey) return -1;
          if (a.sortKey > b.sortKey) return 1;
          return 0;
        });
    });
    return queue;
  }
*/
}

function initializeDiceBotQueue(): PromiseQueue {
  const langSortOrder = ['English', '正體中文', '简体中文', '한국어', 'Other'];
  let queue = new PromiseQueue('DiceBotQueue');
  queue.add(async () => {
    loader = new (await import(
      /* webpackChunkName: "lib/bcdice/bcdice-loader" */
      './bcdice/bcdice-loader')
    ).default;
    DiceBot.diceBotInfos = loader.listAvailableGameSystems()
    .filter(gameSystemInfo => gameSystemInfo.id != 'DiceBot')
    .sort((a ,b) => {
      const aKey: string = a.sortKey;
      const bKey: string = b.sortKey;
      if (aKey < bKey) {
        return -1;
      }
      if (aKey > bKey) {
        return 1;
      }
      return 0
    })
    .map<DiceBotInfo>(gameSystemInfo => {
      const lang = /.+\:(.+)/.exec(gameSystemInfo.id);
      let langName;
      if (lang && lang[1]) {
        langName = (lang[1] == 'ChineseTraditional') ? '正體中文'
          : (lang[1] == 'English') ? 'English'
          : (lang[1] == 'Korean') ? '한국어'
          : (lang[1] == 'SimplifiedChinese') ? '简体中文'
          : 'Other';
      }
      return {
        id: gameSystemInfo.id,
        game: gameSystemInfo.name,
        lang: langName,
        sort_key: gameSystemInfo.sortKey
      };
    });
    DiceBot.diceBotInfos.forEach((info) => {
      let normalize = info.sort_key.normalize('NFKD');
      for (let replaceData of DiceBot.replaceData) {
        if (replaceData[2] && info.game === replaceData[0]) {
          normalize = replaceData[1];
          info.game = replaceData[2];
        }
        normalize = normalize.split(replaceData[0].normalize('NFKD')).join(replaceData[1].normalize('NFKD'));
      }
      normalize = normalize.replace(/[\u3041-\u3096]/g, m => String.fromCharCode(m.charCodeAt(0) + 0x60))
        .replace(/第(.+?)版/g, 'タイ$1ハン')
        .replace(/[・!?！？\s　:：=＝\/／（）\(\)]+/g, '')
        .replace(/([アカサタナハマヤラワ])ー+/g, '$1ア')
        .replace(/([イキシチニヒミリ])ー+/g, '$1イ')
        .replace(/([ウクスツヌフムユル])ー+/g, '$1ウ')
        .replace(/([エケセテネヘメレ])ー+/g, '$1エ')
        .replace(/([オコソトノホモヨロ])ー+/g, '$1オ')
        .replace(/ン+ー+/g, 'ン')
        .replace(/ン+/g, 'ン');
      info.sort_key = info.lang ? info.lang : normalize.normalize('NFKD');
      //return info;
      //console.log(info.index + ': ' + normalize);
    });
    DiceBot.diceBotInfos.sort((a, b) => {
      if (a.lang && b.lang) {
        return langSortOrder.indexOf(a.lang) == langSortOrder.indexOf(b.lang) ? 0 
          : langSortOrder.indexOf(a.lang) < langSortOrder.indexOf(b.lang) ? -1 : 1;
      } else if (a.lang) {
        return 1;
      } else if (b.lang) {
        return -1;
      }
      return a.sort_key == b.sort_key ? 0 
      : a.sort_key < b.sort_key ? -1 : 1;
    });
    let sentinel = DiceBot.diceBotInfos[0].sort_key[0];
    let group = { index: sentinel, infos: [] };
    for (let info of DiceBot.diceBotInfos) {
      if ((info.lang ? info.lang : info.sort_key[0]) !== sentinel) {
        sentinel = info.lang ? info.lang : info.sort_key[0];
        DiceBot.diceBotInfosIndexed.push(group);
        group = { index: sentinel, infos: [] };
      }
      group.infos.push({ id: info.id, game: info.game });
    }
    DiceBot.diceBotInfosIndexed.push(group);
  });
  return queue;
}