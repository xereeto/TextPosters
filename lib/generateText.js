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

// read a row of pixels from the BMP file
function getRow(offset){
    // create empty array to store row
    var row = [];
    // for each byte in the row
    for (var i=offset;i<offset + rowSize;i++){
        // turn the byte into a string of 8 ones and zeros, and for each bit in the string,
        bmpBuffer[i].toPaddedString(2,8).split('').forEach(function(bit){
            // push its inverse into the array (so that black is a 1 and white is a 0)
            bit=="1" ? row.push(0) : row.push(1); // I feel dirty using a string to encode a bit, but hey, this is Javascript
        });
    }
    // remove the padding from the row
    return row.slice(0,row.length-padding);
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

// declare the bit array in memory
var bitArray = [];

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
    bitArray.push(getRow(start + (i-1)*rowSize));
    arrayBar.tick();
}
// initialize the string that will hold the completed image in memory
var imageString = "";
// initialize the counter which increments every time a character is added
var counter=0;
// progress bar
var convertBar = new ProgressBar('Converting image to text   [:bar] :percent :etas', {
    complete: '=',
    incomplete: ' ',
    width: 25,
    total: Math.floor(height/charHeight)*Math.floor(width/charWidth)
});
// split the image into boxes the size of one character
// for each row of boxes...
for (var row = 0; row < Math.floor(height/charHeight)*charHeight; row+=charHeight){
    // ...look inside each box in the row...
    for (var column = 0; column < Math.floor(width/charWidth)*charWidth; column += charWidth) {
        var boxValue = 0;
        // ...and now we want to sum the total number of black pixels inside the box
        // so we loop through each row of pixels...
        for (var y = row; y < row+charHeight;y++)
            // ...and for each pixel in the row...
            for (var x = column; x < column + charWidth; x++)
                // ...we add its value to the total number of black pixels inside the box
                boxValue += bitArray[y][x];
        // if more than half the pixels inside the box are black,
        if (boxValue >= (charWidth*charHeight)/2) {
            // we add a character from the source text to the output "image"
            imageString += corpus[counter];
            counter++;
        }
        else
            // otherwise, we add a space
            imageString += " ";
        convertBar.tick();
    }
    imageString += "\n";
}
console.log("Finished!");
console.log(counter + " characters");
// write finished "image" to an output file
fs.writeFile("output.txt",imageString);
