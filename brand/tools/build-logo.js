// Builds the Nimbus System logo as a self-contained SVG (text converted to outlines).
const opentype=require(process.env.SP+'/ot/node_modules/opentype.js');
const fs=require('fs');
const script=opentype.loadSync(`${process.env.SP}/lf/norican/package/files/norican-latin-400-normal.woff`);
const sans=opentype.loadSync(`${process.env.SP}/lf/archivo-black/package/files/archivo-black-latin-400-normal.woff`);
const NAVY="#1D2557", BLUE="#2A62D0", SKY="#62A0D8", MOUSE_LINE="#9DB7EA", CABLE_BAND="#C9D3E6";
// fit "Nimbus" between x=250 and x=862, baseline y=405 (original image coordinates)
let size=200,p=script.getPath('Nimbus',0,0,size),bb=p.getBoundingBox();
size=size*(606/(bb.x2-bb.x1));p=script.getPath('Nimbus',0,0,size);bb=p.getBoundingBox();
const nimbus=script.getPath('Nimbus',252-bb.x1,412,size).toPathData(1);
// SYSTEM: six evenly spaced capitals
const letters="SYSTEM".split(""),centers=[282,397,512,627,742,857];
const capH=40,lsz=capH/(sans.charToGlyph('S').getBoundingBox().y2/sans.unitsPerEm*1)/1;
const system=letters.map((ch,i)=>{const g=sans.getPath(ch,0,0,lsz),b=g.getBoundingBox();return sans.getPath(ch,centers[i]-(b.x1+b.x2)/2,500,lsz).toPathData(1)}).join("");
const cx=548,cy=332;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="212 26 700 498" role="img" aria-label="Nimbus System">
  <title>Nimbus System</title>
  <path d="M${cx-292} ${cy}A292 292 0 0 1 ${cx+292} ${cy}Z" fill="${NAVY}"/>
  <path d="M${cx-196} ${cy}A196 196 0 0 1 ${cx+196} ${cy}Z" fill="${BLUE}"/>
  <path d="M694 183 C 735 182, 785 187, 828 194" stroke="${CABLE_BAND}" stroke-width="11" fill="none" stroke-linecap="round"/>
  <path d="M556 200 C 584 214, 598 190, 626 194 S 664 186, 696 183" stroke="${NAVY}" stroke-width="6" fill="none" stroke-linecap="round"/>
  <g transform="translate(514 226) rotate(-28) scale(1.15) translate(-514 -226)">
    <path d="M462 226 C 462 200, 495 190, 522 192 C 552 194, 568 212, 566 230 C 564 252, 536 262, 508 260 C 480 258, 462 246, 462 226 Z" fill="${NAVY}" stroke="${MOUSE_LINE}" stroke-width="4.5"/>
    <path d="M468 228 C 492 216, 528 214, 562 222 M520 193 L514 220" stroke="${MOUSE_LINE}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  </g>
  <g fill="#FFFFFF">
    <circle cx="290" cy="302" r="46"/><circle cx="346" cy="284" r="42"/><circle cx="402" cy="298" r="38"/>
    <circle cx="455" cy="312" r="34"/><circle cx="508" cy="318" r="32"/><circle cx="562" cy="318" r="32"/>
    <circle cx="616" cy="306" r="34"/><circle cx="668" cy="290" r="36"/><circle cx="722" cy="286" r="38"/>
    <circle cx="776" cy="300" r="40"/><circle cx="828" cy="314" r="38"/>
    <rect x="240" y="312" width="650" height="220"/>
  </g>
  <g transform="translate(0 412) scale(1.02 1.06) translate(0 -412)">
    <path d="${nimbus}" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="12" stroke-linejoin="round"/>
    <path d="${nimbus}" fill="${NAVY}" stroke="${NAVY}" stroke-width="4.5" stroke-linejoin="round"/>
  </g>
  <path d="${system}" fill="${SKY}"/>
</svg>`;
fs.writeFileSync(process.env.OUT,svg);console.log('written',svg.length);
