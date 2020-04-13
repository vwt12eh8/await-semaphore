// tslint:disable: max-classes-per-file

export class Semaphore {
    private readonly tasks = new Array<() => void>();
    public count: number;

    constructor(count: number) {
        this.count = count;
    }

    private sched() {
        if (this.count > 0 && this.tasks.length > 0) {
            this.count--;
            const next = this.tasks.shift();
            if (next === undefined) {
                throw new Error("Unexpected undefined value in tasks list");
            }

            next();
        }
    }

    public acquire(cancel?: Cancel) {
        cancel?.throwIfCancelled();
        return new Promise<() => void>((res, rej) => {
            const task = () => {
                if (cancel?.isCancelled) {
                    this.count++;
                    this.sched();
                    return;
                }
                cancel?.off(rej);
                let released = false;
                res(() => {
                    if (!released) {
                        released = true;
                        this.count++;
                        this.sched();
                    }
                });
            };
            this.tasks.push(task);
            cancel?.once(rej);
            (process?.nextTick || setImmediate)(this.sched.bind(this));
        });
    }

    public async use<T = void>(f: () => Promise<T>, cancel?: Cancel) {
        const release = await this.acquire(cancel);
        try {
            return await f();
        } finally {
            release();
        }
    }
}

export class Mutex extends Semaphore {
    constructor() {
        super(1);
    }
}

interface Cancel {
    readonly isCancelled: boolean;
    off(listener: (error?: unknown) => void): void;
    once(listener: (error?: unknown) => void): void;
    throwIfCancelled(): void;
}
