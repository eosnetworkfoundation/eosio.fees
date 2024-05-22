#!/bin/bash

cdt-cpp eosio.fees.cpp -I ./include
wasm2wat eosio.fees.wasm | sed -e 's|(memory |(memory (export "memory") |' > eosio.fees.wat
wat2wasm -o eosio.fees.wasm eosio.fees.wat
rm eosio.fees.wat