var a = [1, 2, 3]

switch ('test') {
    case 'test':
        for (const b of a) {
            console.log(b);
            if (b == 2) {
                break;
            }
        }
        
        console.log(0);
        break;
}