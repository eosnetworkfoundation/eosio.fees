#include "eosio.fees.hpp"

namespace eosio {

// @system or @user
[[eosio::on_notify("*::transfer")]]
void fees::on_transfer( const name from, const name to, const asset quantity, const string memo )
{
   // ignore transfers not sent to this contract
   if (to != get_self()) { return; }
}

void fees::distribute()
{
   require_auth( get_self() );
}

} /// namespace eosio
