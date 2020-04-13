import assert = require('assert');
import { Mutex, Semaphore } from './index';

export function delay(ms: number) {
    return new Promise<void>((res) => setTimeout(res, ms));
}

describe('util', () => {
    describe('semaphore', () => {
        it('limits concurrency', async () => {
            const s = new Semaphore(2);
            let running = 0;
            let ran = 0;
            const task = async () => {
                const release = await s.acquire();
                assert(running <= 1);
                running++;
                await delay(10);
                assert(running <= 2);
                running--;
                ran++;
                release();
            };
            await Promise.all([1, 2, 3, 4, 5].map(i => task()));
            assert.equal(ran, 5);
        });

        it('limits concurrency (use syntax)', async () => {
            const s = new Semaphore(2);
            let running = 0;
            let ran = 0;
            const task = async () => {
                assert(running <= 1);
                running++;
                await delay(10);
                assert(running <= 2);
                running--;
                ran++;
            };
            await Promise.all([1, 2, 3, 4, 5].map(i => s.use(task)));
            assert.equal(ran, 5);
        });

        it('use recovers from thrown exception', async () => {
            const s = new Semaphore(2);
            let running = 0;
            let ran = 0;
            let erred = 0;
            const task = (i) => async () => {
                assert(running <= 1);
                running++;
                await delay(10);
                assert(running <= 2);
                running--;
                if (i === 2) {
                    throw new Error('bogus');
                }
                ran++;
            };
            await s.use(task(1));
            try {
                await s.use(task(2));
            } catch (err) {
                erred++;
            }
            await s.use(task(3));
            await s.use(task(4));
            await s.use(task(5));
            assert.equal(ran, 4);
            assert.equal(erred, 1);
            assert.equal(s.count, 2);
        });

    });

    describe('mutex', () => {
        it('tasks do not overlap', (done) => {
            const m = new Mutex();
            let task1running = false;
            let task2running = false;
            let task1ran = false;
            let task2ran = false;
            Promise.all([
                m.acquire()
                    .then(async release => {
                        task1running = true;
                        task1ran = true;
                        await delay(10);
                        assert(!task2running);
                        task1running = false;
                        release();
                    }),
                m.acquire()
                    .then(async release => {
                        assert(!task1running);
                        task2running = true;
                        task2ran = true;
                        await delay(10);
                        task2running = false;
                        release();
                    })
            ])
                .then(() => {
                    assert(!task1running);
                    assert(!task2running);
                    assert(task1ran);
                    assert(task2ran);
                    done();
                }).catch(done);
        });
        it('double lock deadlocks', (done) => {
            const m = new Mutex();
            m.acquire()
                .then(r => m.acquire())
                .then(r => assert(false))
                .catch(done);
            delay(10)
                .then(done);
        });
        it('double release ok', (done) => {
            let release;
            const m = new Mutex();
            m.acquire().
                then(r => release = r).
                then(() => release()).
                then(() => release());
            m.acquire().
                then(r => done());
        });
    });
});