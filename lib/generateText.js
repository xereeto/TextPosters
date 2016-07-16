// for reading image file
var fs = require('fs');
// for displaying a graphical progress bar
var ProgressBar = require('progress');
// for high-level image manipulation
var gm = require('gm').subClass({imageMagick: true});

// make my life easier
Number.prototype.toPaddedString = function(base,minLength) {
    // get the plain number (in the specified base)
    var value = this.toString(base);
    // pad the number to ensure it has at least (minLength) zeros
    var zeros = "";
    for (var i=0;i<minLength;i++)
        zeros += "0";
    return zeros.substring(0,zeros.length-value.length)+value;
}

// read a particular string of bytes for the BMP file
function readAttribute(offset,length){
    var attr = "";
    // start at end byte and read towards start byte; attributes are little-endian
    for (var i=offset+length;i>offset;i--)
        attr += bmpBuffer[i-1].toPaddedString(16,2); 
    return parseInt(attr,16);
}

// read the color table of the bitmap
function readColorTable() {
    var ct = [];
    // start position of the color table is 1024 bytes before the start of the pixel data
    // and each color is 4 bytes
    for (var i = start - 1024; i<start; i+=4)
        // read the color as a decimal and turn it back into a 6 digit RGB hex string to add to the array
        ct.push(readAttribute(i,4).toPaddedString(16,6));
    return ct;
}

// read a row of pixels from the BMP file
function getRow(offset){
    // create empty array to store row
    var row = [];
    // for each byte in the row
    for (var i=offset;i<offset + rowSize;i++){
        if (bitDepth == 1)
            // turn the byte into a string of 8 ones and zeros, and for each bit in the string,
            bmpBuffer[i].toPaddedString(2,8).split('').forEach(function(bit){
                // push it into the array 
                row.push(parseInt(bit)); // I feel dirty using a string to encode a bit, but hey, this is Javascript
            });
        else {
            row.push(bmpBuffer[i]);
        }
    }
    // remove the padding from the row
    return row.slice(0,row.length-(padding/bitDepth));
}

// read BMP file into memory
var bmpBuffer = fs.readFileSync(process.argv[2]);

// read text file into memory
var corpus = fs.readFileSync("corpus.txt").toString();

// read width and height of each character from command line
var charWidth = parseInt(process.argv[3]); 
var charHeight = parseInt(process.argv[4]); 

// get the offset at which the pixel data is stored
var start = readAttribute(10,4);
//get the bit depth of the image
var bitDepth = readAttribute(28,2);
// get the width and height of the image in pixels
var width = readAttribute(18,4);
var height = readAttribute(22,4);

// determine the number of bytes it takes to store a single row
var rowSize = Math.floor((width*bitDepth + 31)/32)*4;
// determine how many of those bytes are utter shit (i.e., padding)
var padding = 8*(rowSize - (width*bitDepth)/8);

// declare the bit array and color table in memory
var colorTable; 
var bitArray = [];
// set the color table
bitDepth == 1 ? colorTable = [ "000000", "FFFFFF" ] : colorTable = readColorTable();

// create progress bar for this process
var arrayBar = new ProgressBar('Adding pixels to bit array [:bar] :percent :etas', {
    complete: '=',
    incomplete: ' ',
    width: 25,
    total: height
});

// for each row of pixels in the image
for (var i=height;i>0;i--) {
    // read the row into the array
    //console.log("Start: " + parseInt(start) + " Rowsize: " + parseInt(rowSize) + " (i-1)*rowsize: " + parseInt((i-1)*rowSize) + " ALL: " + parseInt(parseInt(start) + parseInt((i-1)*rowSize)));  
    bitArray.push(getRow(start  + (i-1)*rowSize));
    arrayBar.tick();
}
// initialize the string that will hold the completed image in memory
var preface = "<html><head><style>body { color: FGGOESHERE; background-color: BGGOESHERE; font-size: xx-small; font-family: Droid sans mono, courier, monospace; }</style></head><body><pre>";
var imageString = "";
var colors = [];
// initialize the counter which increments every time a character is added
var counter=0;
// progress bar
var convertBar = new ProgressBar('Converting image to text   [:bar] :percent :etas', {
    complete: '=',
    incomplete: ' ',
    width: 25,
    total: Math.floor(height/charHeight)*Math.floor(width/charWidth)
});
var total = { red: 0, blue: 0, green: 0 };
// split the image into boxes the size of one character
// for each row of boxes...
for (var row = 0; row < Math.floor(height/charHeight)*charHeight; row+=charHeight){
    // ...look inside each box in the row...
    for (var column = 0; column < Math.floor(width/charWidth)*charWidth; column += charWidth) {
        var boxValue = { red: 0, blue: 0, green: 0 };
        // ...and now we want to sum the total number of black pixels inside the box
        // so we loop through each row of pixels...
        for (var y = row; y < row+charHeight;y++)
            // ...and for each pixel in the row...
            for (var x = column; x < column + charWidth; x++) {
                // ...we add its value to the total number of black pixels inside the box
                var color = colorTable[bitArray[y][x]];
                boxValue.red += parseInt(color.slice(0,2),16);
                boxValue.green += parseInt(color.slice(2, 4),16);
                boxValue.blue += parseInt(color.slice(4,6),16);
            }
        if (bitDepth == 1)
            // if more than half the pixels inside the box are black,
            if (boxValue.red/256 <= (charWidth*charHeight)/2) {
                // we add a character from the source text to the output "image"
                imageString += corpus[counter];
                counter++;
            } else
                // otherwise, we add a space
                imageString += "&nbsp;";
        else {
            var boxColor = Math.round((boxValue.red / (charWidth*charHeight))).toPaddedString(16,2) + Math.round((boxValue.green / (charWidth*charHeight))).toPaddedString(16,2) + Math.round((boxValue.blue / (charWidth*charHeight))).toPaddedString(16,2);
            if (parseInt(boxColor,16) != 0) {
                colors.push(boxColor);
                imageString += "<font color='#" + boxColor + "'>" + corpus[counter] + "</font>";
                counter++;
            } else 
                imageString += "&nbsp;";
            
        }
        total.red += boxValue.red;
        total.green += boxValue.green;
        total.blue += boxValue.blue;
        convertBar.tick();
    }
    imageString += "<br>";
}
var hsp = Math.sqrt( Math.pow((total.red / (width*height)),2) * 0.299 + Math.pow((total.green / (width*height)),2) * 0.587 + Math.pow((total.blue / (width*height)),2) * 0.114 );
if (bitDepth == 1) 
    preface = preface.replace("FGGOESHERE","#000").replace("BGGOESHERE","#FFF");
else
    preface = preface.replace("FGGOESHERE","#FFF").replace("BGGOESHERE","#000");
console.log(hsp);
imageString = preface + imageString + "</body></html>";
console.log("Finished!");
console.log(counter + " characters");
// write finished "image" to an output file
fs.writeFile("output.html",imageString);
