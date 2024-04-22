#include "eosio.fees.hpp"

namespace eosio {

[[eosio::action]]
void fees::init( const uint32_t epoch_time_interval ) {
    require_auth( get_self() );

    settings_table _settings( get_self(), get_self().value );
    auto settings = _settings.get_or_default();
    settings.epoch_time_interval = epoch_time_interval;
    _settings.set(settings, get_self());
}

[[eosio::action]]
void fees::setstrategy( const name strategy, const uint16_t weight ) {
    require_auth( get_self() );

    strategies_table _strategies( get_self(), get_self().value );

    // validate input
    check(weight > 0, "weight must be greater than 0");
    check(STRATEGIES.find(strategy) != STRATEGIES.end(), "strategy not defined");

    // update weights
    auto itr = _strategies.find(strategy.value);
    if (itr == _strategies.end()) {
        _strategies.emplace(get_self(), [&](auto& row) {
            row.strategy = strategy;
            row.weight = weight;
        });
    } else {
        _strategies.modify(itr, get_self(), [&](auto& row) {
            row.weight = weight;
        });
    }
}

[[eosio::action]]
void fees::delstrategy( const name strategy )
{
    require_auth( get_self() );

    strategies_table _strategies( get_self(), get_self().value );
    auto &itr = _strategies.get(strategy.value, "strategy not found");
    _strategies.erase(itr);
}

[[eosio::action]]
void fees::distribute()
{
    // any authority is allowed to call this action
    update_next_epoch();

    strategies_table _strategies( get_self(), get_self().value );
    const uint16_t total_weight = get_total_weight();

    // distributing fees in EOS
    const asset balance = eosio::token::get_balance( "eosio.token"_n, get_self(), symbol_code("EOS") );

    for ( auto& row : _strategies ) {
        const asset fee_to_distribute = balance * row.weight / total_weight;
        if (fee_to_distribute.amount <= 0) continue; // skip if no fee to distribute

        // Donate to REX
        // Distributes fees to REX pool which is distributed to REX holders over a 30 day period
        if ( row.strategy == "donatetorex"_n) {
            eosiosystem::system_contract::donatetorex_action donatetorex( "eosio"_n, { get_self(), "active"_n });
            donatetorex.send( get_self(), fee_to_distribute, "system fees" );
        // Buy RAM & Burn
        // locks up additional EOS in RAM pool while reducing the total circulating supply of RAM
        } else if ( row.strategy == "buyramburn"_n) {
            eosiosystem::system_contract::buyramburn_action buyramburn( "eosio"_n, { get_self(), "active"_n });
            buyramburn.send( get_self(), fee_to_distribute, "system fees" );
        // Buy RAM Self
        // Accumulates RAM bytes within the `eosio.fees` account
        } else if ( row.strategy == "buyramself"_n) {
            eosiosystem::system_contract::buyramself_action buyramself( "eosio"_n, { get_self(), "active"_n });
            buyramself.send( get_self(), fee_to_distribute );
        }
    }
}

uint16_t fees::get_total_weight()
{
    strategies_table _strategies( get_self(), get_self().value );

    uint16_t total_weight = 0;
    for (auto& row : _strategies) {
        total_weight += row.weight;
    }
    return total_weight;
}

void fees::update_next_epoch()
{
    fees::settings_table _settings( get_self(), get_self().value );
    auto settings = _settings.get();

    // handle epoch
    const uint32_t now = current_time_point().sec_since_epoch();
    const uint32_t interval = settings.epoch_time_interval;
    check( settings.next_epoch_timestamp.sec_since_epoch() <= now, "epoch not finished");

    // update next epoch (round to the next interval)
    settings.next_epoch_timestamp = time_point_sec( (now / interval) * interval + interval );
    _settings.set( settings, get_self() );
}

} /// namespace eosio
