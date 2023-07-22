import {IAdapter} from "../IAdapter";

export class JsonAdapter implements IAdapter<any> {

    private readonly adapter: IAdapter<string>;
    private readonly humanReadable: boolean;
    private readonly dateRegex = new RegExp('^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}', 'm')


    constructor(adapter: IAdapter<string>, humanReadable = false) {
        this.adapter = adapter;
        this.humanReadable = humanReadable;
    }

    private replacer(key: string, value: any): any {
        return value;
    }

    private reviver(key: string, value: any): any {
        if (typeof value == "string" && this.dateRegex.exec(value) != null) {
            return new Date(value);
        }
        return value;
    }

    read(): any {
        const data = this.adapter.read();
        if (data == null) {
            this.write({});
            return {};
        }
        return JSON.parse(data, this.reviver.bind(this));
    }

    write(data: any): void {
        let stringify = '';
        if (this.humanReadable) {
            stringify = JSON.stringify(data, this.replacer.bind(this), 4)
        } else {
            stringify = JSON.stringify(data, this.replacer.bind(this))
        }
        this.adapter.write(stringify);
    }

}