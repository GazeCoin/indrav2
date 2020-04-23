#!/usr/bin/env bash
set -e

package="$1"
version="$2"

if [[ -z "$package" || -z "$version" || -n "$3" ]]
then echo "Usage: bash ops/set-dependency-version.sh <package> <version>" && exit 1
else echo "Setting package $package to version $version in all modules that depend on it"
fi

echo
echo "Before:"
grep -r '"'$package'"' modules/*/package.json
echo

find modules/*/package.json \
  -type f \
  -exec sed -i -E 's|"'"$package"'": "[0-9.]+"|"'"$package"'": "'"$version"'"|g' {} \;

echo "After:"
grep -r '"'$package'"' modules/*/package.json
echo
