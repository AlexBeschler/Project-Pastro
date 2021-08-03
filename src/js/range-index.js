var ProjectPastroRangeIndex = function () {
    this._map = [];

    //Utilities
    this.add = function (docID, value) {
        var index = {
            docID: docID,
            value: value
        };
        if (this._map.length > 0) {
            this._map.splice(_.sortedIndex(this._map, index, 'value'), 0, index);
        } else {
            this._map.push(index);
        }
    }
    this.remove = function(docID, value) {
        var firstMatchIndex = -1;
        var lastMatchIndex = -1;
        var low = 0;
        var mid = 0;
        var high = this._map.length - 1;
        while (low <= high) {
            mid = Math.floor((low + high) / 2);

            if (this._map[mid].value === value) {
                lastMatchIndex = mid;
                firstMatchIndex = mid;
                while (lastMatchIndex + 1 < this._map.length && this._map[lastMatchIndex + 1].value === value) {
                    lastMatchIndex++;
                }
                while (firstMatchIndex - 1 >= 0 && this._map[firstMatchIndex - 1].value === value) {
                    firstMatchIndex--;
                }
                var range = {
                    low: firstMatchIndex,
                    high: lastMatchIndex
                };
                if (firstMatchIndex < 0) {
                    return;
                }
                //Cycle through range to remove by docID
                while (range.low <= range.high) {
                    if (this._map[range.low].docID === docID) {
                        this._map.splice(range.low, 1);
                        //Knock the range high down since we spliced, and offset the low range
                        range.high--;
                        range.low--;
                    }
                    range.low++;
                }
                return;
            } else if (this._map[mid].value > value) {
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }
    }
    this.search = function (query) {
        var docIDs = [];
        var left = 0;
        var right = this._map.length;
        var mid;

        while (left < right) {
            mid = (right + left) >> 1;

            // Check if key is present in array
            if (this._map[mid].value == query) {

                // If duplicates are present it returns the position of last element
                while ((mid + 1) < this._map.length && this._map[mid + 1].value == query) {
                    mid++;
                }
                break;
            }

            // If key is smaller, ignore right half
            else if (this._map[mid].value > query)
                right = mid;

            // If key is greater, ignore left half
            else
                left = mid + 1;
        }

        // If key is not found in array then it will be before mid
        while (mid > -1 && this._map[mid].value > query)
            mid--;

        if (mid == -1) {
            return docIDs;
        } else {
            while (mid >= 0) {
                docIDs.push(this._map[mid].docID);
                mid -= 1;
            }
        }
        return docIDs;
    }
}