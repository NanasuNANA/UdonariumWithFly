import { animate, keyframes, style, transition, trigger } from '@angular/animations';
import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { Card, CardState } from '@udonarium/card';
import { StringUtil } from '@udonarium/core/system/util/string-util';

@Component({
  selector: 'card-list-image',
  templateUrl: './card-list-image.component.html',
  styleUrls: ['./card-list-image.component.css'],
  animations: [
    trigger('reverseCard', [
      transition(':increment', [
        animate('132ms ease-in-out', keyframes([
          style({ transform: 'rotateZ(0deg)', offset: 0 }),
          style({ transform: 'rotateZ(90deg)', offset: 0.5 }),
          style({ transform: 'rotateZ(180deg)', offset: 1.0 })
        ]))
      ]),
      transition(':decrement', [
        animate('132ms ease-in-out', keyframes([
          style({ transform: 'rotateZ(180deg)', offset: 0 }),
          style({ transform: 'rotateZ(270deg)', offset: 0.5 }),
          style({ transform: 'rotateZ(360deg)', offset: 1.0 })
        ]))
      ])
    ]),
    trigger('flipCard', [
      transition(':increment,:decrement', [
        animate('132ms ease-in-out', keyframes([
          style({ transform: 'scaleX(1.0)', offset: 0 }),
          style({ transform: 'scaleX(0.1)', offset: 0.5 }),
          style({ transform: 'scaleX(1.0)', offset: 1.0 })
        ]))
      ])
    ])
  ]
})
export class CardListImageComponent implements OnInit {
  @Input() card: Card = null;
  @ViewChild('cardImage', { static: true }) cardImageElement: ElementRef;
  
  readonly CardStateFront = CardState.FRONT;
  readonly CardStateBack = CardState.BACK;

  gridSize = 50;
  naturalWidth = 0;
  naturalHeight = 0;

  constructor() { }

  ngOnInit(): void {
  }

  onCardImageLoad() {
    if (!this.cardImageElement) return;
    this.naturalWidth = this.cardImageElement.nativeElement.naturalWidth;
    this.naturalHeight = this.cardImageElement.nativeElement.naturalHeight;
  }

  get rubiedText(): string { return this.card ? StringUtil.rubyToHtml(StringUtil.escapeHtml(this.card.text)) : '' }

  get imageAreaRect(): {width: number, height: number, top: number, left: number, scale: number} {
    return this.calcImageAreaRect(64, 64, 0);
  }

  private calcImageAreaRect(areaWidth: number, areaHeight: number, offset: number): {width: number, height: number, top: number, left: number, scale: number} {
    const rect = {width: 0, height: 0, top: offset, left: offset, scale: 1};
    if (this.naturalWidth == 0 || this.naturalHeight == 0) return rect;

    const viewWidth = areaWidth - offset * 2;
    const viewHeight = areaHeight - offset * 2;
    // scale使わなかった頃の名残
    if ((this.naturalHeight * viewWidth / this.naturalWidth) > viewHeight) {
      rect.width = this.naturalWidth * viewHeight / this.naturalHeight;
      rect.height = viewHeight;
      rect.left = offset + (viewWidth - rect.width) / 2;
    } else {
      rect.width = viewWidth;
      rect.height = this.naturalHeight * viewWidth / this.naturalWidth;
      rect.top = offset + (viewHeight - rect.height) / 2;
    } 

    if (this.card) {
      rect.scale = rect.width / (this.card.size * this.gridSize);
      rect.width = this.card.size * this.gridSize;
      rect.height = rect.width * this.naturalHeight / this.naturalWidth;
    }
    return rect;
  }

  get cardColor(): string {
    return this.card ? this.card.color : '#555555';
  }

  get cardFontSize(): number {
    return this.card ? this.card.fontsize + 9 : 18;
  }

  get cardText(): string {
    return this.card ? this.card.text : '';
  }

  get textShadowCss(): string {
    const shadow = StringUtil.textShadowColor(this.cardColor);
    return `${shadow} 0px 0px 2px, 
    ${shadow} 0px 0px 2px, 
    ${shadow} 0px 0px 2px, 
    ${shadow} 0px 0px 2px, 
    ${shadow} 0px 0px 2px, 
    ${shadow} 0px 0px 2px,
    ${shadow} 0px 0px 2px,
    ${shadow} 0px 0px 2px`;
  }
}
