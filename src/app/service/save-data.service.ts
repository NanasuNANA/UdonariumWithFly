import { Injectable, NgZone } from '@angular/core';

import { ChatTabList } from '@udonarium/chat-tab-list';
import { FileArchiver } from '@udonarium/core/file-storage/file-archiver';
import { ImageFile, ImageState } from '@udonarium/core/file-storage/image-file';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { MimeType } from '@udonarium/core/file-storage/mime-type';
import { GameObject } from '@udonarium/core/synchronize-object/game-object';
import { PromiseQueue } from '@udonarium/core/system/util/promise-queue';
import { XmlUtil } from '@udonarium/core/system/util/xml-util';
import { DataSummarySetting } from '@udonarium/data-summary-setting';
import { DiceRollTableList } from '@udonarium/dice-roll-table-list';
import { Room } from '@udonarium/room';

import Beautify from 'vkbeautify';

import { ImageTagList } from '@udonarium/image-tag-list';
import { ChatTab } from '@udonarium/chat-tab';
import { CutInList } from '@udonarium/cut-in-list';
import { ChatMessageService } from './chat-message.service';
import { StringUtil } from '@udonarium/core/system/util/string-util';
import saveAs from 'file-saver';

type UpdateCallback = (percent: number) => void;

@Injectable({
  providedIn: 'root'
})
export class SaveDataService {
  private static queue: PromiseQueue = new PromiseQueue('SaveDataServiceQueue');

  constructor(
    private ngZone: NgZone,
    private chatMessageService: ChatMessageService
  ) { }

  saveRoomAsync(fileName: string = 'fly_房間資料', updateCallback?: UpdateCallback): Promise<void> {
    this.chatMessageService.sendOperationLog(`房間資料 ${fileName}.zip 已儲存`);
    return SaveDataService.queue.add((resolve, reject) => resolve(this._saveRoomAsync(fileName, updateCallback)));
  }

  private _saveRoomAsync(fileName: string = 'fly_房間資料', updateCallback?: UpdateCallback): Promise<void> {
    let files: File[] = [];
    let roomXml = this.convertToXml(new Room());
    let chatXml = this.convertToXml(ChatTabList.instance);
    let diceRollTableXml = this.convertToXml(DiceRollTableList.instance);
    let cutInXml = this.convertToXml(CutInList.instance);
    let summarySetting = this.convertToXml(DataSummarySetting.instance);
    files.push(new File([roomXml], 'fly_data.xml', { type: 'text/plain' }));
    files.push(new File([chatXml], 'fly_chat.xml', { type: 'text/plain' }));
    files.push(new File([diceRollTableXml], 'fly_rollTable.xml', { type: 'text/plain' }));
    files.push(new File([cutInXml], 'fly_cutIn.xml', { type: 'text/plain' }));
    files.push(new File([summarySetting], 'summary.xml', { type: 'text/plain' }));

    //files = files.concat(this.searchImageFiles(roomXml));
    //files = files.concat(this.searchImageFiles(chatXml));
    let images: ImageFile[] = [];
    images = images.concat(this.searchImageFiles(roomXml));
    images = images.concat(this.searchImageFiles(chatXml));
    images = images.concat(this.searchImageFiles(cutInXml));
    for (const image of images) {
      if (image.state === ImageState.COMPLETE) {
        files.push(new File([image.blob], image.identifier + '.' + MimeType.extension(image.blob.type), { type: image.blob.type }));
      }
    }
    let imageTagXml = this.convertToXml(ImageTagList.create(images));

    files.push(new File([imageTagXml], 'fly_imageTag.xml', { type: 'text/plain' }));
    return this.saveAsync(files, this.appendTimestamp(fileName), updateCallback);
  }

  saveGameObjectAsync(gameObject: GameObject, fileName: string = 'fly_xml_data', updateCallback?: UpdateCallback): Promise<void> {
    this.chatMessageService.sendOperationLog(`${StringUtil.aliasNameToClassName(gameObject.aliasName)} 資料 ${fileName}.zip 已儲存`);
    return SaveDataService.queue.add((resolve, reject) => resolve(this._saveGameObjectAsync(gameObject, fileName, updateCallback)));
  }

  private _saveGameObjectAsync(gameObject: GameObject, fileName: string = 'fly_xml_data', updateCallback?: UpdateCallback): Promise<void> {
    let files: File[] = [];
    let xml: string = this.convertToXml(gameObject);

    files.push(new File([xml], 'fly_data.xml', { type: 'text/plain' }));
    //files = files.concat(this.searchImageFiles(xml));
    
    let images: ImageFile[] = [];
    images = images.concat(this.searchImageFiles(xml));
    for (const image of images) {
      if (image.state === ImageState.COMPLETE) {
        files.push(new File([image.blob], image.identifier + '.' + MimeType.extension(image.blob.type), { type: image.blob.type }));
      }
    }
    let imageTagXml = this.convertToXml(ImageTagList.create(images));
    
    files.push(new File([imageTagXml], 'fly_imageTag.xml', { type: 'text/plain' }));
    return this.saveAsync(files, this.appendTimestamp(fileName), updateCallback);
  }

  private saveAsync(files: File[], zipName: string, updateCallback?: UpdateCallback): Promise<void> {
    let progresPercent = -1;
    return FileArchiver.instance.saveAsync(files, zipName, meta => {
      let percent = meta.percent | 0;
      if (percent <= progresPercent) return;
      progresPercent = percent;
      this.ngZone.run(() => updateCallback(progresPercent));
    });
  }

  private convertToXml(gameObject: GameObject): string {
    let xmlDeclaration = '<?xml version="1.0" encoding="UTF-8"?>';
    return xmlDeclaration + '\n' + Beautify.xml(gameObject.toXml(), 2);
  }

  private searchImageFiles(xml: string): ImageFile[] {
    let xmlElement: Element = XmlUtil.xml2element(xml);
    let files: ImageFile[] = [];
    if (!xmlElement) return files;

    let images: { [identifier: string]: ImageFile } = {};
    let imageElements = xmlElement.ownerDocument.querySelectorAll('*[type="image"]');

    for (let i = 0; i < imageElements.length; i++) {
      let identifier = imageElements[i].innerHTML;
      images[identifier] = ImageStorage.instance.get(identifier);

      let shadowIdentifier = imageElements[i].getAttribute('currentValue');
      if (shadowIdentifier) images[shadowIdentifier] = ImageStorage.instance.get(shadowIdentifier);
    }

    imageElements = xmlElement.ownerDocument.querySelectorAll('*[imageIdentifier], *[toImageIdentifier], *[backgroundImageIdentifier], *[backgroundImageIdentifier2]');

    for (let i = 0; i < imageElements.length; i++) {
      let identifier = imageElements[i].getAttribute('imageIdentifier');
      if (identifier) images[identifier] = ImageStorage.instance.get(identifier);

      let toIdentifier = imageElements[i].getAttribute('toImageIdentifier');
      if (toIdentifier) images[identifier] = ImageStorage.instance.get(toIdentifier);

      let backgroundImageIdentifier = imageElements[i].getAttribute('backgroundImageIdentifier');
      if (backgroundImageIdentifier) images[backgroundImageIdentifier] = ImageStorage.instance.get(backgroundImageIdentifier);

      let backgroundImageIdentifier2 = imageElements[i].getAttribute('backgroundImageIdentifier2');
      if (backgroundImageIdentifier2) images[backgroundImageIdentifier2] = ImageStorage.instance.get(backgroundImageIdentifier2);
    }
    for (let identifier in images) {
      let image = images[identifier];
      //if (image && image.state === ImageState.COMPLETE) {
      //  files.push(new File([image.blob], image.identifier + '.' + MimeType.extension(image.blob.type), { type: image.blob.type }));
      //}
      if (image) {
        files.push(image);
      }
    }
    return files;
  }

  private appendTimestamp(fileName: string): string {
    let date = new Date();
    let year = date.getFullYear();
    let month = ('00' + (date.getMonth() + 1)).slice(-2);
    let day = ('00' + date.getDate()).slice(-2);
    let hours = ('00' + date.getHours()).slice(-2);
    let minutes = ('00' + date.getMinutes()).slice(-2);

    return fileName + `_${year}-${month}-${day}_${hours}${minutes}`;
  }

  saveChatLog(logFormat: number, fileName: string, chatTabs: ChatTab[]=null, dateFormat='HH:mm', isWriteOerationLog=true) {
    const mimeType = (logFormat == 0 ? 'text/plain' : 'text/html');
    const ext = (logFormat == 0 ? '.txt' : '.html');
    const trueFileName = 'fly_' + this.appendTimestamp(fileName) + ext;
    this.chatMessageService.sendOperationLog(`聊天記錄 ${trueFileName} 已儲存`);
    //const xml = ChatTabList.instance.log(logFormat, dateFormat, isWriteOerationLog, chatTabs);
    
    //const files: File[] = [];
    //files.push(new File([xml], trueFileName, {type: `${mimeType};charset=utf-8`}));

    saveAs(new Blob([ChatTabList.instance.log(logFormat, dateFormat, isWriteOerationLog, null, chatTabs)], {type: `${mimeType};charset=utf-8`}), trueFileName);
  }

  async saveChatLogAsync(logFormat: number, fileName: string, chatTabs: ChatTab[]=null, dateFormat='HH:mm', isWriteOerationLog=true, updateCallback?: UpdateCallback): Promise<void> {
    const trueFileName = 'fly_' + this.appendTimestamp(fileName);
    this.chatMessageService.sendOperationLog(`聊天記錄 ${trueFileName}.zip 已儲存`);
    const files: File[] = [];
    const images: ImageFile[] = (chatTabs ? chatTabs : [ChatTabList.instance]).reduce<ImageFile[]>((acm, obj) => acm.concat(this.searchImageFiles(this.convertToXml(obj))), []);
    const imageDict = {};
    const basename = path => path.split('/').pop().split('.').shift();
    let isLicenseIncluded = false;
    let isCopyrightIncluded = false;
    for (const image of images) {
      if (!imageDict[image.identifier]) {
        if (image.state === ImageState.COMPLETE) {
          const fileName = image.identifier + '.' + MimeType.extension(image.blob.type);
          imageDict[image.identifier] = 'images/' + fileName;
          files.push(new File([image.blob], 'images/' + fileName, { type: image.blob.type }));
        } else if (image.state === ImageState.URL) {
          if (image.url.startsWith('http')) {
            if (StringUtil.validUrl(image.url)) imageDict[image.identifier] = image.url;
          } else {
            await fetch(image.url)
              .then(response => response.blob())
              .then(blob => {
                const fileName = basename(image.identifier) + '.' + MimeType.extension(blob.type);
                imageDict[image.identifier] = 'udonarium_assets/' + fileName;
                files.push(new File([blob], 'udonarium_assets/' + fileName, { type: blob.type }))
              });
            if (image.url.indexOf('/dice/') >= 0) {
              if (!isLicenseIncluded) {
                await fetch('./assets/images/dice/license.txt')
                  .then(response => response.blob())
                  .then(blob => {
                    files.push(new File([blob], 'udonarium_assets/license.txt', { type: 'text/plain' }));
                    isLicenseIncluded = true;
                  });
              }
            } else {
              if (!isCopyrightIncluded) {
                await fetch('./assets/images/copyright.txt')
                  .then(response => response.blob())
                  .then(blob => {
                    files.push(new File([blob], 'udonarium_assets/copyright.txt', { type: 'text/plain' }));
                    isCopyrightIncluded = true;
                  });
              }
            }
          }
        }
      }
    }
    files.push(new File([ChatTabList.instance.log(logFormat, dateFormat, isWriteOerationLog, imageDict, chatTabs)], 'index.html', {type: 'text/html;charset=utf-8'}));
    return this.saveAsync(files, trueFileName, updateCallback);
  }
}