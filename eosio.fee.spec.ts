import {Asset, Int64, Name} from '@wharfkit/antelope'
import {Blockchain, expectToThrow} from '@proton/vert'
import {describe, expect, test} from 'bun:test'

// Vert EOS VM
const blockchain = new Blockchain()
const alice = 'alice'
const bob = 'bob'
const charles = 'charles'
blockchain.createAccounts(bob, alice, charles)

const fee_contract = 'eosio.fee'
const contracts = {
    fee: blockchain.createContract(fee_contract, fee_contract, true),
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
    const row = contracts.fee.tables
        .accounts(scope)
        .getTableRow(primary_key)
    if (!row) return 0;
    return Asset.from(row.balance).units.toNumber()
}

function getTokenSupply(symcode: string) {
    const scope = Asset.SymbolCode.from(symcode).value.value
    const row = contracts.fee.tables
        .stat(scope)
        .getTableRow(scope)
    if (!row) return 0;
    return Asset.from(row.supply).units.toNumber()
}

function getRamBytes(account: string) {
    const scope = Name.from(account).value.value
    const row = contracts.system.tables
        .userres(scope)
        .getTableRow(scope)
    if (!row) return 0
    return Int64.from(row.ram_bytes).toNumber()
}

describe(fee_contract, () => {
    test('eosio::init', async () => {
        await contracts.system.actions.init([]).send()
    })

    test('eosio.token::issue::EOS', async () => {
        const supply = `1000000000.0000 EOS`
        await contracts.token.actions.create(['eosio.token', supply]).send()
        await contracts.token.actions.issue(['eosio.token', supply, '']).send()
        await contracts.token.actions.transfer(['eosio.token', alice, '1000.0000 EOS', '']).send()
        await contracts.token.actions.transfer(['eosio.token', bob, '1000.0000 EOS', '']).send()
        await contracts.token.actions.transfer(['eosio.token', charles, '1000.0000 EOS', '']).send()
    })
})