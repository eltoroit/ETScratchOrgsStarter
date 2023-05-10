// # Execute using: npm run createOrg
import OS2 from './lowLevelOs.js';

console.log('Hello World', OS2);

// # --- Define local folder
// 	DIR="${BASH_SOURCE%/*}"
// 	if [[ ! -d "$DIR" ]]; then DIR="$PWD"; fi

// # --- check for node_modules folder
// 	if [ ! -d "node_modules" ]; then
// 		echo "Please run npm install"
// 		exit 0
// 	fi

// # --- check for ETCopyData
// 	echo "Validating ETCopyData..."
// 	echo "n" | sfdx plugins | grep 'etcopydata' > /dev/null 2>&1
// 	if [ ! $? -eq 0 ]; then
// 		echo "Please ensure ETCopyData is installed. Check this repo: https://github.com/eltoroit/ETCopyData"
// 		exit 0
// 	fi
