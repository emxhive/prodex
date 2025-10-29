// @ts-nocheck

if (!String.prototype.norm) {
    String.prototype.norm = function () {
        return this.replace(/\\/g, "/");
    };
}
