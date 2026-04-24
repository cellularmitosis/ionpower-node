function abbr(num)
{

    if(num >= 1000000){
      	return (num/1000000)+'m';    	
    }
    else if(num >= 1000){
		return (num/1000)+'k';
    }
    else{
    	return (num);	
    }
   
}

module.exports = abbr;
