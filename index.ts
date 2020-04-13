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

    public acquire() {
        return new Promise<() => void>((res, rej) => {
            const task = () => {
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
            (process?.nextTick || setImmediate)(this.sched.bind(this));
        });
    }

    public async use<T>(f: () => Promise<T>) {
        const release = await this.acquire();
        try {
            const res = await f();
            release();
            return res;
        }
        catch (err) {
            release();
            throw err;
        }
    }
}

export class Mutex extends Semaphore {
    constructor() {
        super(1);
    }
}
