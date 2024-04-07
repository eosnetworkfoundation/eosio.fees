import { Asset, Int64, Name } from '@wharfkit/antelope'
import { describe, expect, test } from 'bun:test'
import { Blockchain, expectToThrow } from '@eosnetwork/vert'
import { TimePointSec } from "@greymass/eosio";

// Vert EOS VM
const blockchain = new Blockchain()
const burn = 'eosio.null'
const rex = 'eosio.rex'
const ram = 'eosio.ram'
const bob = 'bob'
blockchain.createAccounts(burn, rex, ram, bob)

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

function getRamBytes(account: string) {
    const scope = Name.from(account).value.value
    const row = contracts.system.tables
        .userres(scope)
        .getTableRow(scope)
    if (!row) return 0
    return Int64.from(row.ram_bytes).toNumber()
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
        await contracts.fees.actions.init([600]).send()
    })

    test("eosio.fees::setstrategy", async () => {
        await contracts.fees.actions.setstrategy(['donatetorex', 600]).send();
        await contracts.fees.actions.setstrategy(['buyramburn', 300]).send();
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
        expect(after.burn.bytes - before.burn.bytes).toBe(17507766)

        // EOS
        expect(after.fees.balance - before.fees.balance).toBe(-60000000)
        expect(after.rex.balance - before.rex.balance).toBe(40000000)
        expect(after.ram.balance - before.ram.balance).toBe(20000000)
    });

    test('eosio.fees::distibute::error - epoch not finished', async () => {
        const action = contracts.fees.actions.distribute([]).send();
        await expectToThrow(action, 'eosio_assert: epoch not finished')
    })

    test("eosio.fees::distibute - after 10 minutes & user authority", async () => {
        const time = TimePointSec.fromInteger(600);
        await blockchain.addTime(time);
        await contracts.fees.actions.distribute([]).send(bob); // any user is authorized to call distribute
    });
})