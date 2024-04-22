#pragma once

#include <eosio/eosio.hpp>
#include <eosio.system/eosio.system.hpp>
#include <eosio.token/eosio.token.hpp>
#include <eosio/singleton.hpp>

using namespace std;

namespace eosio {

    const set<name> STRATEGIES = {
        "buyramburn"_n,
        "buyramself"_n,
        "donatetorex"_n
    };
    /**
     * The `eosio.fees` contract handles system fees distribution.
     */
    class [[eosio::contract("eosio.fees")]] fees : public contract {
    public:
        using contract::contract;

        /**
         * ## TABLE `strategies`
         *
         * - `{name} strategy` - strategy name
         * - `{uint16_t} weight` - strategy weight (proportional to the total weight of all strategies)
         *
         * ### example
         *
         * ```json
         * [
         *   {
         *     "strategy": "buyramburn",
         *     "weight": 60
         *   },
         *   {
         *     "strategy": "donatetorex",
         *     "weight": 30
         *   }
         * ]
         * ```
         */
        struct [[eosio::table("strategies")]] strategies_row {
            name                strategy;
            uint16_t            weight;

            uint64_t primary_key() const { return strategy.value; }
        };
        typedef eosio::multi_index< "strategies"_n, strategies_row > strategies_table;

        /**
         * ## TABLE `settings`
         *
         * - `{uint32} epoch_time_interval` - epoch time interval in seconds (time between epoch distribution events)
         * - `{time_point_sec} next_epoch_timestamp` - next epoch timestamp event to trigger strategy distribution
         *
         * ### example
         *
         * ```json
         * {
         *   "epoch_time_interval": 600,
         *   "next_epoch_timestamp": "2024-04-07T00:00:00"
         * }
         * ```
         */
        struct [[eosio::table("settings")]] settings_row {
            uint32_t            epoch_time_interval = 600; // 10 minutes
            time_point_sec      next_epoch_timestamp;
        };
        typedef eosio::singleton< "settings"_n, settings_row > settings_table;

        /**
         * Initialize the contract with the epoch period.
         *
         * @param epoch_period - epoch period in seconds
         */
        [[eosio::action]]
        void init( const uint32_t epoch_period );

        /**
         * Set a strategy with a weight.
         *
         * @param strategy - strategy name
         * @param weight - strategy weight
         */
        [[eosio::action]]
        void setstrategy( const name strategy, const uint16_t weight );

        /**
         * Delete a strategy.
         *
         * @param strategy - strategy name
         */
        [[eosio::action]]
        void delstrategy( const name strategy );

        /**
         * Distribute fees to all defined strategies.
         */
        [[eosio::action]]
        void distribute();

        using distribute_action = eosio::action_wrapper<"distribute"_n, &fees::distribute>;

    private:
        void update_next_epoch();
        uint16_t get_total_weight();
    };
} /// namespace eosio
