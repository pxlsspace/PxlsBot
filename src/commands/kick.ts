if (msg.content.startsWith("$kick ")) {
    if (msg.mentions.members.first()) {
        msg.mentions.members.first.kick().then((member) => {
            msg.channel.send(":wave: " + member.displayName + " has been kicked from the server :sunglasses: ");
        }).catch(() => {
            msg.channel.send("I do not have permissions to do this");
        });
    }
}else if (msg.content.startsWith("$ban ")) {
    if (msg.mentions.members.first()) {
        msg.mentions.members.first.ban().then((member) => {
            msg.channel.send(":wave: " + member.displayName + " has been banned from the server :sunglasses: ");
        }).catch(() => {
            msg.channel.send("I do not have permissions to do this");
        });
    }
} #shoutout to "TiteiikoMP4" for existing!
