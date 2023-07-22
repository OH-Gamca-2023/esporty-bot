/**
 * Use to read and write data of type T
 */
export interface IAdapter<T> {

    /**
     * Read the data from the medium synchronously
     */
    read: () => T | null
    /**
     * Write date into the medium synchronously
     * @param data
     */
    write: (data: T) => void
}

export interface IFileAdapter<T> extends IAdapter<T> {
    /**
     * Name of the file used by the file adapter
     */
    readonly filename: string;
}