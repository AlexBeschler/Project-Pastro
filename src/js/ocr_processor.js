var ProjectPastroOCR = function () {
    this.utils = new ProjectPastroUtils();
    this.nlp = new ProjectPastroNLP();

    this.init = function () {
        this.utils.init();
        this.nlp.init();
    }

    this.processOCR = function (res) {
        var blocks = res.data.recognizedText.pages[0].blocks;

        var paragraphs = [];
        var line = '';
        for (var i = 0; i < blocks.length; i++) {
            //Get current line from paragraph
            var paragraph = blocks[i].paragraphs[0]; //Each block seems to have only 1 paragraph
            paragraph.words.forEach(word => {
                line += word.symbols.map(s => s.text).join('');
                line += ' ';
            });

            //Do lookahead vertices analysis
            if (i + 1 < blocks.length) {
                //We want to compare the top rectangle to the bottom rectangle, accounting for slope 
                // (because users don't take perfectly centered images).
                // If the 2 rectangles have 100 px or more space between them, arbitrarily decide
                // to call the 2nd rectangle a new paragraph

                //Get bounding box for current block
                var vertices1 = blocks[i].boundingBox.vertices;
                var vertices2 = blocks[i + 1].boundingBox.vertices;

                //Top box point 1
                var xTop1 = vertices1[3].x;
                var yTop1 = vertices1[3].y;
                //Top box point 2
                var xTop2 = vertices1[2].x;
                var yTop2 = vertices1[2].y;

                //Bottom box point 1
                var xBottom1 = vertices2[0].x;
                var yBottom1 = vertices2[0].y;
                //Bottom box point 2
                var xBottom2 = vertices2[1].x;
                var yBottom2 = vertices2[1].y;

                //Get slopes
                var slope1 = Math.abs((yTop2 - yTop1) / (xTop2 - xTop1));
                var slope2 = Math.abs((yBottom2 - yBottom1) / (xBottom2 - xBottom1));
                if ((yBottom1 / (1 + slope2)) - (yTop1 / (1 + slope1)) >= 100) {
                    //It's a new paragraph
                    paragraphs.push(this.naturalize(line.trim()));
                    line = '';
                }
            } else {
                paragraphs.push(this.naturalize(line.trim()));
                line = '';
            }
        }

        return paragraphs;
    }

    //Text may contain:
    // All uppercase;
    // Word-breaking hyphenations 
    this.naturalize = function (paragraph) {
        //Break up by sentence
        var sentences = paragraph.split('.');
        var result = '';
        sentences.forEach(sentence => {
            //If text is in all caps, only capitalize first letter
            if (this.utils.isAllUppercase(sentence)) {
                sentence = this.utils.capitalizeFirstLetter(sentence.toLowerCase());
            }

            //Scans paragraph for "automatic hyphenation" dashes.
            //Identify if the context is an amount of something, otherwise remove it
            if (sentence.includes('-')) {
                let index = sentence.indexOf('-');
                //Get the word before the dash
                let stack = [];
                while (index >= 0 || sentence[index] === ' ') {
                    stack.push(sentence[index]);
                    index--;
                }
                let sample = [];
                for (var i = 0; i < stack.length; i++) {
                    sample.push(stack.pop());
                }
                //Get the word after the dash. Keep in mind - with automated hyphens there's sometimes a space directly after
                index = sentence.indexOf('-');
                if (index + 1 < sentence.length) { //Just to make sure
                    if (sentence[index + 1] === ' ') {
                        index += 2;
                    } else {
                        index += 1;
                    }
                    do {
                        sample.push(sentence[index]);
                        index++;
                    } while (index < sentence.length || sentence[index] === ' ');
                    var r = this.nlp.parseIngredient(sample.join(''));

                    //Means we can remove the dash and space right after
                    if (r.amount === '') {
                        index = sentence.indexOf('-');
                        sentence = sentence.replace(sentence.substring(index, index + 2), '');
                    }
                }
            }

            result += sentence;
            result += '.';
        });
        //Remove last '.' at the end of the string
        result = result.substring(0, result.length - 1);
        return result;
    }
}