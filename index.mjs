/*

This is the genopets harvest tracker.
Version : 1.0.0
Author : _AoS

*/


import { createRequire } from 'module';
import inquirer from 'inquirer';
import chalk from 'chalk';
const require = createRequire(import.meta.url);

const solanaweb3 = require('@solana/web3.js');
const fs = require('fs');
const openpgp = require('openpgp');
const figlet = require("figlet");
const shell = require("shelljs");

const numTx  = 100;
const filePath = 'HabitatInfo.txt';



//constants
const LICENSE_VALIDITY = 'system.license_validity';
const LICENSE_START_DATE = 'system.license_start_date';
const SYSTEM_PROPERTY_PREFIX = 'system.';
const ENDPOINT_1 = "system.endpoint1";
const LICENSE_FILE_NAME = "license";

const MENU_OPTION_SHOW_ALL = "1";
const MENU_OPTION_SHOW_SPECIFIC = "2";
const MENU_OPTION_SELECT_FROM_LIST = "3";
const MENU_OPTION_EXIT = "4";





let searchAddressList =    [];
let kiData  = [];
let harvestPending = [];
let fileData = [];

let searchAddressMap = new Map();
let fileDataMap = new Map();
let tranListMap = new Map();

let address;

function kiTransactionInfo (address, energyused, KI, waitPeriod, date, harvestTime, claimPending) {
    this.address  = address,
    this.energyused = energyused ,
    this.KI = KI,
    this.waitPeriod = waitPeriod,
    this.date = date,
    this.harvestTime = harvestTime,
    this.claimPending = claimPending
}

// Displaying the interactive options.
const askQuestions = () => {
    const questions = [
      {
        type: "list",
        name: "OPTION",
        message: "Select an option",
        choices: ["1. List harvesting of  all habitats", "2. Check a habitat by providing address","3. Select from registered habitats ", "4. Exit Application"],
        filter: function(val) {
          return val.split(".")[0];
        }
      }
    ];
    return inquirer.prompt(questions);
  };

function title() {
    console.log(
        chalk.greenBright(
          figlet.textSync("Genopets Harvest Tracker", {
            font: "Red Phoenix",
            horizontalLayout: "default",
            verticalLayout: "default"
            
          })
        )
      );
}


const run = async () => {

    await readFileData();
    if(!isValidLicense()) {
        process.exit();
    }

    title();
    const answers = await askQuestions();

    const { OPTION } = answers;

    //console.log(OPTION);

    switch(OPTION) {
        case MENU_OPTION_SHOW_ALL :
            await getHarvestInfo();
            break;
        case MENU_OPTION_SHOW_SPECIFIC :
            const questions = [
                {
                    type: 'input',
                    name: 'HABITAT_ADDRESS',
                    message: 'Provide Habitat Address: '
                },
            ];
            const {HABITAT_ADDRESS} = await inquirer.prompt(questions);
            
            if(isAddressAvailable(HABITAT_ADDRESS)) {
                console.log(chalk.greenBright(`\n${HABITAT_ADDRESS} is in the accessible list.`))
                await getTransactions(HABITAT_ADDRESS, numTx);
                parseWholeTranList();
            }
            else {
                console.log(chalk.redBright(`${HABITAT_ADDRESS} is not in the accessible list.`))
            }
            break; 
        case MENU_OPTION_SELECT_FROM_LIST :
            
            const addresskey = searchAddressMap.keys();
            let searchAddressList = [];
            let  value;
            while((value = addresskey.next().value) != null) {
                searchAddressList.push(value);
            }


            const questions1 = [
                {
                  type: "list",
                  name: "SEARCH_ADDRESS",
                  message: "Select an option",
                  choices: searchAddressList,
                  filter: function(val) {
                    return val;
                  }
                },
            ];
            const {SEARCH_ADDRESS} = await inquirer.prompt(questions1);

            await getTransactions(searchAddressMap.get(SEARCH_ADDRESS), numTx);
            parseWholeTranList();
            break;
        case MENU_OPTION_EXIT :
            process.exit();
    }

    setTimeout(run, 0);

}


function isAddressAvailable(habitatAddress) {
    let i=0;

    while(searchAddressList[i] != null) {

        if(searchAddressList[i] == habitatAddress) {
            return true;
        }
        i++;
    }
    return false;

}


const getHarvestInfo = async() => {

    const addresses = fileDataMap.keys();
    let searchAddress;
    
    for(let i = 0; i< searchAddressList.length; i++)
        await getTransactions(searchAddressList[i], numTx);
    
    parseWholeTranList();
}




const getTransactions = async(address, numTx) => {


    console.log(chalk.green(`\nPulling transaction data for : ${fileDataMap.get(address)}\n`));

    let solanaConnection = new solanaweb3.Connection(fileDataMap.get(ENDPOINT_1));
    const pubKey = new solanaweb3.PublicKey(address);
    let transactionList =  await solanaConnection.getSignaturesForAddress(pubKey, {limit:numTx});

    let transactions =  [] ;
    
    transactionList.forEach((transaction, i) => {

        let signature =  transaction.signature;
        transactions.push(signature);  
    })
    
    await getTransactionList(transactions, address);

    
}

//pulling transaction details with signature provided... 

const getTransactionList = async(transactions,address) => {

    let solanaConnection = new solanaweb3.Connection(fileDataMap.get(ENDPOINT_1));
    let transactionList =  await solanaConnection.getTransactions(transactions);
    
    await sleep(2000);

    transactionList.forEach((thisTransaction, i) => {
    
        if(thisTransaction != null && thisTransaction.meta != null && thisTransaction.meta.fee == "15000") {
            
            //Finding whether we have HarvestKI in the log.
            for(let i =0; thisTransaction.meta.logMessages[i] != null; i++) {

                if(thisTransaction.meta.logMessages[i].includes("HarvestKi")) {
                    if(tranListMap.get(address) != null ) {

                        let transactions = tranListMap.get(address);
                        transactions.push(thisTransaction);
                        tranListMap.set(address, transactions);    

                   } 
                   else {
                        let transactions = [thisTransaction];
                        tranListMap.set(address, transactions);
                   }    
                   break;
                }
            }
        }
    })    
} 
    
function parseWholeTranList()  {

    let harvestingPending = [];
    
    searchAddressList.forEach(searchAddress => {

        let tranList = tranListMap.get(searchAddress);
        

        if(null != tranList && tranList.length >=0) {
            tranList.forEach((transaction, i) => {

                let index = 0;

                

                for(let i =0; transaction.meta.logMessages[i] != null; i++) {

                    if(transaction.meta.logMessages[i].includes("HarvestKi")) {
                        index = i;
                        break;
                    }
                }

                if(index !=0 ) {

                    //finding the correct row for the KI info from `HarvestKI line`
                    let parseKIInfo = [];
                    for(let j = index+1 ; transaction.meta.logMessages[j] != null ; j++) {

                        const stringKIInfo = transaction.meta.logMessages[j];

                        if(stringKIInfo.indexOf('Energy Amount') > -1) {
                            parseKIInfo = stringKIInfo.split(`,`);
                            break;
                        }
                    }
            
                    if(parseKIInfo.length > 3) {  //this if is to avoid an edge case where creating a subhabitat will throw array index error.

                        //get Energy
                        let energy = parseFloat(parseKIInfo[0].split(`:`)[2]);
    
                        //get KI
                        let getKI = parseFloat(parseKIInfo[3].split(`:`)[1]);
                        getKI = getKI/1000000000;

                        //get wait period
                        let wp = parseFloat(parseKIInfo[1].split(`:`)[1]);

                        //date
                        const date = new Date(transaction.blockTime*1000);

                        let diff = Math.abs(new Date() - date)
                        let timeDiff = convertMS(diff);
                        let claimPending = convertMS(wp*24*60*60*1000 - diff >  0 ? wp*24*60*60*1000 - diff : 0);

                        kiData.push(new kiTransactionInfo(fileDataMap.get(searchAddress),
                                        energy,getKI,wp,date,timeDiff, 
                                        claimPending == '0:0:0:0' ? "Claim" : claimPending));
                    }
                }    
            })
        }
       
        if(kiData.length > 0) {
            console.table(kiData);
            let diff = Math.abs(new Date() - kiData[0].date);
            if(diff > 24*60*60*1000) {
                //console.log("Harvest Pending");
                harvestingPending.push(kiData[0].address);
            }
        }

        kiData = [];
        
    })

    
    console.log(chalk.redBright("Potential Pending Harvest : "));
    if(harvestingPending.length > 0)
        console.table(chalk.green(harvestingPending));
    else
        console.log(chalk.greenBright("None"));

    console.log(chalk.blue())

    // Clear the memory
    tranListMap = new Map();
    searchAddressList = [];
    harvestingPending = [];
    searchAddressMap = new Map();
}

//utility function for time conversion

function convertMS(ms) {
    let d, h, m, s;
    s = Math.floor(ms / 1000);
    m = Math.floor(s / 60);
    s = s % 60;
    h = Math.floor(m / 60);
    m = m % 60;
    d = Math.floor(h / 24);
    h = h % 24;
    //h += d * 24;
    return d + ':' + h + ':' + m + ':' + s;
}

//utility function for sleep

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

//utility function to decrypt data


//utility to read data from file into application

 const readFileData =  async() => {

    try {
        // read contents of the file

        //const data = fs.readFileSync(filePath, 'UTF-8');
        const decryptedText = await decryptFile();

        // split the contents by new line
        fileData = decryptedText.toString().split(/\r?\n/);

        // parse whole file line by line and add data to the map
        fileData.forEach((line) => {
            //console.log(line);
            let splitData = line.split('=');

            if(splitData.length == 2) {
                fileDataMap.set(splitData[0].trim(), splitData[1].trim());
                //adding the address info to the searchList omitting system properties
                if(!splitData[0].includes(SYSTEM_PROPERTY_PREFIX)) {
                    searchAddressList.push(splitData[0].trim());
                    //searchAddressNames.push(splitData[1].trim());
                    searchAddressMap.set(splitData[1].trim(), splitData[0].trim());
                }
            }
        });

       // console.log(fileDataMap);
    } catch (err) {
        console.error(err);
    }

}


function isValidLicense() {

    let licenseValidDays = fileDataMap.get(LICENSE_VALIDITY);
    let licenseStartDate = fileDataMap.get(LICENSE_START_DATE);

    if(licenseValidDays != null && licenseStartDate != null) {

        let validDate =  new Date(licenseStartDate + "Z");
        //validDate = validDate + parseInt(licenseValidDays);
        let daysActive = new Date() - validDate;

        if(daysActive > (1000*60*60*24* parseInt(licenseValidDays)) ) {
            console.log(chalk.redBright("\nLicense Expired. Please contact the application owner for renewal. Discord : _AoS#8573"));
            return false;
        }
        else {
            console.log(chalk.greenBright("\nLicense Valid"));
            return true;
        }

    }

}

const decryptFile = async() => {

    const privateKey = fs.readFileSync('Key').toString();
  
    const privateArmouredKey = await openpgp.readPrivateKey({armoredKey : privateKey});
    //const openpgpPrivateKey =  await openpgp.decryptKey({privateKey : privateArmouredKey, 
        //passphrase : 'This is to fool people who think they know what they  doing.'});
    const openpgpPrivateKey =  await openpgp.decryptKey({privateKey : privateArmouredKey, 
                                            passphrase : '20OCUG31!n_1!44c120OCUG31!n_1!43c1'});
    
    const file = fs.readFileSync(LICENSE_FILE_NAME);
    const fileString = file.toString();
    
  
    const message = await openpgp.readMessage({
        armoredMessage: fileString // parse armored message
    });
    const decryptedResponse= await openpgp.decrypt({
        message,
        decryptionKeys: openpgpPrivateKey
    });
  
    return decryptedResponse.data;
  
  };


//getHarvestInfo();


const main = async() => {

    await readFileData();
    isValidLicense();
   // getHarvestInfo();

}

//main();
run();

