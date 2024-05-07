import { Asset, Int64, Name } from '@wharfkit/antelope'
import { describe, expect, test } from 'bun:test'
import { Blockchain, expectToThrow } from '@eosnetwork/vert'
import { TimePointSec } from "@greymass/eosio";

// Vert EOS VM
const blockchain = new Blockchain()
const burn = 'eosio.null'
const rex = 'eosio.rex'
const ram = 'eosio.ram'
const bpay = 'eosio.bpay'
const bonds = 'eosio.bonds'
const bob = 'bob'
blockchain.createAccounts(burn, rex, ram, bpay, bonds, bob)

const fees_contract = 'eosio.fees'
const contracts = {
    fees: blockchain.createContract(fees_contract, fees_contract, true),
    token: blockchain.createContract('eosio.token', 'external/eosio.token/eosio.token', true),
    system: blockchain.createContract('eosio', 'external/eosio.system/eosio', true),
    fake: {
        token: blockchain.createContract('fake.token', 'external/eosio.token/eosio.token', true),
        system: blockchain.createContract('fake', 'external/eosio.system/eosio', true),
    },
}

function getTokenBalance(account: string, symcode: string) {
    const scope = Name.from(account).value.value
    const primary_key = Asset.SymbolCode.from(symcode).value.value
    const row = contracts.token.tables
        .accounts(scope)
        .getTableRow(primary_key)
    if (!row) return 0;
    return Asset.from(row.balance).units.toNumber()
}

function getStrategies() {
    const scope = Name.from(fees_contract).value.value
    const row = contracts.fees.tables
        .strategies(scope)
        .getTableRows()
    return row;
}

function getRamBytes(account: string) {
    const scope = Name.from(account).value.value
    const row = contracts.system.tables
        .userres(scope)
        .getTableRow(scope)
    if (!row) return 0
    return Int64.from(row.ram_bytes).toNumber()
}

const TEN_MINUTES = 600;

function incrementTime(seconds = TEN_MINUTES) {
    const time = TimePointSec.fromInteger(seconds);
    return blockchain.addTime(time);
}

describe(fees_contract, () => {
    test('eosio::init', async () => {
        await contracts.system.actions.init([]).send()
    })

    test('eosio.token::issue::EOS', async () => {
        const supply = `1000000000.0000 EOS`
        await contracts.token.actions.create(['eosio.token', supply]).send()
        await contracts.token.actions.issue(['eosio.token', supply, '']).send()
    })

    test('eosio.fees::init', async () => {
        await contracts.fees.actions.init([TEN_MINUTES]).send()
    })

    test("eosio.fees::setstrategy", async () => {
        await contracts.fees.actions.setstrategy(['donatetorex', 500]).send();
        await contracts.fees.actions.setstrategy(['buyramburn', 1000]).send();
    });

    test("eosio.fees::distibute", async () => {
        await contracts.token.actions.transfer(['eosio.token', fees_contract, '6000.0000 EOS', '']).send();
        const before = {
            fees: {
                balance: getTokenBalance(fees_contract, 'EOS'),
            },
            ram: {
                balance: getTokenBalance(ram, 'EOS'),
            },
            rex: {
                balance: getTokenBalance(rex, 'EOS'),
            },
            burn: {
                bytes: getRamBytes(burn),
            },
        }
        await contracts.fees.actions.distribute([]).send();

        const after = {
            fees: {
                balance: getTokenBalance(fees_contract, 'EOS'),
            },
            ram: {
                balance: getTokenBalance(ram, 'EOS'),
            },
            rex: {
                balance: getTokenBalance(rex, 'EOS'),
            },
            burn: {
                bytes: getRamBytes(burn),
            },
        }

        // bytes
        expect(after.burn.bytes - before.burn.bytes).toBe(35010801)

        // EOS
        expect(after.fees.balance - before.fees.balance).toBe(-60000000)
        expect(after.rex.balance - before.rex.balance).toBe(20000000)
        expect(after.ram.balance - before.ram.balance).toBe(40000000)
    });

    test('eosio.fees::distibute::error - epoch not finished', async () => {
        const action = contracts.fees.actions.distribute([]).send();
        await expectToThrow(action, 'eosio_assert: epoch not finished')
    })

    test("eosio.fees::distibute - after 10 minutes & user authority", async () => {
        incrementTime();
        await contracts.fees.actions.distribute([]).send(bob); // any user is authorized to call distribute
    });

    test("eosio.fees::buyramself", async () => {
        // 66.6% RAM buy / 33.3% REX
        await contracts.fees.actions.delstrategy(['buyramburn']).send();
        await contracts.fees.actions.setstrategy(['buyramself', 1000]).send();
        await contracts.token.actions.transfer(['eosio.token', fees_contract, '1500.0000 EOS', '']).send();
        incrementTime();
        const before = {
            rex: {
                balance: getTokenBalance(rex, 'EOS'),
            },
            fees: {
                bytes: getRamBytes(fees_contract),
            },
            burn: {
                bytes: getRamBytes(burn),
            }
        }
        await contracts.fees.actions.distribute([]).send();
        const after = {
            rex: {
                balance: getTokenBalance(rex, 'EOS'),
            },
            fees: {
                bytes: getRamBytes(fees_contract),
            },
            burn: {
                bytes: getRamBytes(burn),
            }
        }
        expect(after.fees.bytes - before.fees.bytes).toBe(8754474)
        expect(after.rex.balance - before.rex.balance).toBe(5000000)
    });

    test("eosio.fees::eosio.bpay", async () => {
        // 100% Block Producer Pay
        await contracts.fees.actions.delstrategy(['buyramself']).send();
        await contracts.fees.actions.delstrategy(['donatetorex']).send();
        await contracts.fees.actions.setstrategy(['eosio.bpay', 1000]).send();
        const before = {
            bpay: {
                balance: getTokenBalance(bpay, 'EOS'),
            },
            fees: {
                balance: getTokenBalance(fees_contract, 'EOS'),
            },
        }
        await contracts.token.actions.transfer(['eosio.token', fees_contract, '1000.0000 EOS', '']).send();
        incrementTime();
        await contracts.fees.actions.distribute([]).send();
        const after = {
            bpay: {
                balance: getTokenBalance(bpay, 'EOS'),
            },
            fees: {
                balance: getTokenBalance(fees_contract, 'EOS'),
            },
        }
        expect(after.bpay.balance - before.bpay.balance).toBe(10000000)
        expect(after.fees.balance - before.fees.balance).toBe(0)
    });

    test("eosio.fees::eosio.bonds", async () => {
        // 100% to Bonds
        await contracts.fees.actions.delstrategy(['eosio.bpay']).send();
        await contracts.fees.actions.setstrategy(['eosio.bonds', 1000]).send();
        const before = {
            bonds: {
                balance: getTokenBalance(bonds, 'EOS'),
            },
            fees: {
                balance: getTokenBalance(fees_contract, 'EOS'),
            },
        }
        await contracts.token.actions.transfer(['eosio.token', fees_contract, '1000.0000 EOS', '']).send();
        incrementTime();
        await contracts.fees.actions.distribute([]).send();
        const after = {
            bonds: {
                balance: getTokenBalance(bonds, 'EOS'),
            },
            fees: {
                balance: getTokenBalance(fees_contract, 'EOS'),
            },
        }
        expect(after.bonds.balance - before.bonds.balance).toBe(10000000)
        expect(after.fees.balance - before.fees.balance).toBe(0)
    });
})