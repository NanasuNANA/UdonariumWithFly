export interface OperateCommand {
  targetName?: string,
  operator?: string,
  value?: string,
  isEscapeRoll?: boolean,
  isIncomplete?: boolean
}

export interface OperateCommandsInfo {
  commands: OperateCommand[],
  commandString: string,
  endString: string
}

export enum CompareOption {
  None = 0,
  IgnoreCase = 1,
  IgnoreWidth = 2,
}

export namespace StringUtil {

  const EMOJI_REGEXP = new RegExp([
    '\ud83c[\udf00-\udfff]',
    '\ud83d[\udc00-\ude4f]',
    '\ud83d[\ude80-\udeff]',
    '\ud7c9[\ude00-\udeff]',
    '[\u2600-\u27BF]'
  ].join('|'));

  export function isEmote(str: string): boolean {
    if (!str) return false;
    str = this.cr(str).replace(/[\s\r\n]/g, '');
    return Array.from(str).length <= 3 && !/[「」]/.test(str) && (EMOJI_REGEXP.test(str) || /[$＄\\￥！？❕❢‽‼/!/?♥♪♬♩♫☺🤮❤️☠️]/.test(str)); 
  }

  export function cr(str: string): string {
    if (str == null || str == '') return '';
    let ret = '';
    let flg = '';
    [...str].forEach(c => {
      if (flg) {
        switch (c) {
          case 'n':
          case 'ｎ':
            ret += "\n";
            break;
          case 's':
          case 'ｓ':
            ret += (c === 's' ? " " : "　");
            break;
          case '\\':
          case '￥':
            ret += c;
            break;
          default:
            ret += (flg + c);
        }
        flg = '';
      } else if (c == '\\' || c == '￥') {
        flg = c;
      } else {
        ret += c;
      }
    });
    return ret + flg;
  }

  export function parseCommands(input: string, quote=false): OperateCommandsInfo {
    const separatorRegExp = /[:：]/;
    const operatorRegExp = /[＋＝+\-=―—‐－>＞]/; 
    const spaceRegExp = /[\s　]/; 
    const endRegExp = /[:：\s　]/; 
    const qupteOpenTestRegExps = [separatorRegExp, operatorRegExp];
    const qupteCloseTestRegExps = [operatorRegExp, endRegExp];
    const stateEndRegExp = [operatorRegExp, separatorRegExp];
    
    const charAry = [...input];

    const commands: OperateCommand[] = [];
    let commandString = '';

    let i = 0;
    let state = 0; // 0:操作対象 1:値
    let command: OperateCommand = {};
    let currentPart = '';
    let quoteChar = '';
    let escapeChar = '';
    let tmpCommandString = '';
    for (; i < charAry.length; i++) {
      const char = charAry[i];
      if ((!quote || !quoteChar) && spaceRegExp.test(char)) break;

      if (escapeChar) {
        if (!(separatorRegExp.test(char) || operatorRegExp.test(char) || (quote && char === quoteChar))) currentPart += escapeChar;
        currentPart += char;
        tmpCommandString += char;
        escapeChar = '';
        continue;
      }
  
      if (char === "\\" || char === "￥") {
        escapeChar = char;
        tmpCommandString += char;
        continue;
      }
  
      if (quote && quoteChar) {
        if (char === quoteChar && (charAry[i - 1] == null || qupteCloseTestRegExps[state].test(charAry[i + 1]))) {
          quoteChar = '';
        } else {
          currentPart += char;
        }
        tmpCommandString += char;
      } else if (quote && (char === '"' || char === "'") && (charAry[i - 1] == null || qupteOpenTestRegExps[state].test(charAry[i - 1]))) {
        quoteChar = char;
        tmpCommandString += char;
      } else if (stateEndRegExp[state].test(char)) {
        tmpCommandString += char;
        switch (state) {
        case 0:
          command.targetName = quoteChar + currentPart;
          command.operator = this.toHalfWidth(char.replace(/[―ー—‐]/g, '-'));
          state = 1;
          break;
        case 1:
          command.value = quoteChar + currentPart;
          //if (/^\\[^\\\s]/.test(this.toHalfWidth(command.value).trimLeft())) {
          //  command.isEscapeRoll = true;
          //  command.value = command.value.replace(/[\\￥]/, '');
          //}
          commands.push(command);
          command = {};
          state = 0;
          break;
        }
        commandString += tmpCommandString;
        tmpCommandString = ''
        currentPart = '';
        quoteChar = '';
      } else {
        currentPart += char;
        tmpCommandString += char;
      }
    }

    const flagment = quoteChar + currentPart + escapeChar;
    switch (state) {
    case 0:
      if (flagment == '') break;
      command.targetName = flagment;
      commandString += flagment;
      command.isIncomplete = true;
      commands.push(command);
      break;
    case 1:
      command.value = flagment;
      //if (/^\\[^\\]/.test(this.toHalfWidth(command.value).trimLeft())) {
      //  command.isEscapeRoll = true;
      //  command.value = command.value.replace(/[\\￥]/, '');
      //}
      commandString += flagment;
      commands.push(command);
      break;
    }

    return { 
      commands: commands, 
      commandString: commandString,
      endString: ((i < charAry.length) ? charAry.slice(i).join('') : '').replace(/^[\s　]/, '')
    };
  }

  export function validUrl(url: string): boolean {
    if (!url) return false;
    try {
      new URL(url.trim());
    } catch (e) {
      return false;
    }
    return /^https?\:\/\//.test(url.trim());
  }

  export function sameOrigin(url: string): boolean {
    if (!url) return false;
    try {
      return (new URL(url)).origin === window.location.origin;
    } catch (e) {
      return false;
    }
  }

  export function escapeHtml(str) {
    if(typeof str !== 'string') {
      str = str.toString();
    }
    return str.replace(/[&'`"<>]/g, function(match){
      return {
        '&': '&amp;',
        "'": '&#x27;',
        '`': '&#x60;',
        '"': '&quot;',
        '<': '&lt;',
        '>': '&gt;',
      }[match]
    });
  }

  export function rubyToHtml(str) {
    if(typeof str !== 'string') {
      str = str.toString();
    }
    return str.replace(/[\|｜]([^\|｜\s]+?)《(.+?)》/g, '<ruby>$1<rp>(</rp><rt>$2</rt><rp>)</rp></ruby>');
  }
  
  export function rubyToText(str) {
    if(typeof str !== 'string') {
      str = str.toString();
    }
    return str.replace(/[\|｜]([^\|｜\s]+?)《(.+?)》/g, '$1($2)');
  }

  export function aliasNameToClassName(aliasName: string) {
    switch(aliasName) {
      case 'character':
        return '角色';
      case 'cut-in':
        return '插圖';
      case 'dice-roll-table':
        return '骰子機器人表';
      case 'terrain':
        return '地形';
      case 'table-mask':
        return '地圖遮罩';
      case 'text-note':
        return '共有備注';
      case 'card':
        return '牌';
      case 'dice-symbol':
        return '骰子符號';
      case 'card-stack':
        return '山札';
      case 'game-table':
        return '桌面';
      case 'chat-tab':
        return '聊天分頁';
      case 'range':
        return '射程・範圍';
      default:
       return aliasName;
    }
  }

  export function textShadowColor(textColor: string, lightColor='#ffffff', darkColor='#333333'): string {
    //let str = textColor && /^\#[0-9a-f]{6}$/i.test(textColor) ? '#' + (textColor.substring(1, 7).match(/.{2}/g).reduce((a, c) => { let d = (255 - parseInt(c, 16)).toString(16).toLowerCase(); return a + ('0' + d).substring(d.length - 1); }, '')) : '#ffffff';
    //console.log(str)
    //return str;
    return textColor && /^\#[0-9a-f]{6}$/i.test(textColor) ? (textColor.substring(1, 7).match(/.{2}/g).reduce((a, c) => { return a + parseInt(c, 16); }, 0) > 255 * 2 ? darkColor : lightColor) : lightColor;
  }

  export function toHalfWidth(str: String): string {
    if (str == null || str.toString() == '') return '';
    return str.toString().replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  }
  
  export function equals(str1: string, str2: string, option: CompareOption = CompareOption.None): boolean {
    return str1.length === str2.length && (str1 === str2 || normalize(str1, option) === normalize(str2, option));
  }

  export function normalize(str: string, option: CompareOption): string {
    if (option === CompareOption.None) return str;
    let normalize = str;

    if (option & CompareOption.IgnoreCase) normalize = normalize.toLocaleLowerCase();
    if (option & CompareOption.IgnoreWidth) normalize = toHalfWidth(normalize);

    return normalize;
  }
}
