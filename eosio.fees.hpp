#pragma once

#include <eosio/eosio.hpp>
#include <eosio.system/eosio.system.hpp>
#include <eosio/singleton.hpp>

using namespace std;

namespace eosio {
   /**
    * The `eosio.fees` contract handles system fees distribution.
    */
   class [[eosio::contract("eosio.fees")]] fees : public contract {
      public:
         using contract::contract;

         /**
          * Disallow sending tokens to this contract.
          */
         [[eosio::on_notify("*::transfer")]]
         void on_transfer(const name from, const name to, const asset quantity, const string memo);

         [[eosio::action]]
         void distribute();

         using distribute_action = eosio::action_wrapper<"distribute"_n, &fees::distribute>;
   };
} /// namespace eosio
