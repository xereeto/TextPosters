#!/usr/bin/env node
var fs = require('fs');
var ProgressBar = require('progress');

Number.prototype.toPaddedString = function(base,minLength) {
    var value = this.toString(base);
    var zeros = "";
    for (var i=0;i<minLength;i++)
        zeros += "0";
    return zeros.substring(0,zeros.length-value.length)+value;
}
function readAttribute(offset,length){
    var attr = "";
    for (var i=offset+length;i>offset;i--)
        attr += bmpBuffer[i-1].toPaddedString(16,2);
    return parseInt(attr,16);
}
function getRow(offset){
    var row = [];
    for (var i=offset;i<offset + rowSize;i++){
        bmpBuffer[i].toPaddedString(2,8).split('').forEach(function(bit){
            bit=="1" ? row.push(0) : row.push(1);
        });
    }
    return row.slice(0,row.length-padding);
}

var bmpBuffer = fs.readFileSync(process.argv[2]);
var corpus = fs.readFileSync("corpus.txt").toString();
var charWidth = parseInt(process.argv[3]); //21
var charHeight = parseInt(process.argv[4]); //42

var start = bmpBuffer[10];
var width,height;
width = readAttribute(18,4);
height = readAttribute(22,4);
var rowSize = Math.floor((width + 31)/32)*4;
var padding = 8*(rowSize - width/8);
var bitArray = [];
var arrayBar = new ProgressBar('Adding pixels to bit array [:bar] :percent :etas', {
    complete: '=',
    incomplete: ' ',
    width: 25,
    total: height
});
for (var i=height;i>0;i--) {
    bitArray.push(getRow(start + (i-1)*rowSize));
    arrayBar.tick();
}
var imageString = "";
var counter=0;
var convertBar = new ProgressBar('Converting image to text   [:bar] :percent :etas', {
    complete: '=',
    incomplete: ' ',
    width: 25,
    total: Math.floor(height/charHeight)*Math.floor(width/charWidth)
});
//EVERY ROW OF BOXES
for (var row = 0; row < Math.floor(height/charHeight)*charHeight; row+=charHeight){
    //EVERY BOX
    for (var column = 0; column < Math.floor(width/charWidth)*charWidth; column += charWidth) {
        var boxValue = 0;
        //EVERY ROW OF PIXELS INSIDE THE BOX
        for (var y = row; y < row+charHeight;y++)
            //EVERY PIXEL
            for (var x = column; x < column + charWidth; x++)
                boxValue += bitArray[y][x];
        if (boxValue >= (charWidth*charHeight)/2) {
            imageString += corpus[counter];
            counter++;
        }
        else
            imageString += " ";
        convertBar.tick();
    }
    imageString += "\n";
}
console.log("Finished!");
console.log(counter + " characters");
fs.writeFile("output.txt",imageString);
