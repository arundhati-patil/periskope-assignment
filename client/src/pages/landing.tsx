import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, Users, Zap } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-wa-primary via-wa-secondary to-wa-accent">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6">
            <MessageCircle className="w-10 h-10 text-wa-primary" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">
            Welcome to Chat
          </h1>
          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            Connect with friends and colleagues in real-time. Start conversations, 
            share moments, and stay connected wherever you are.
          </p>
          <Button 
            size="lg" 
            className="bg-white text-wa-primary hover:bg-white/90 text-lg px-8 py-3"
            onClick={() => window.location.href = '/api/login'}
          >
            Get Started
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardContent className="p-6 text-center">
              <MessageCircle className="w-12 h-12 text-white mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Real-time Messaging
              </h3>
              <p className="text-white/80">
                Send and receive messages instantly with our real-time chat system.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardContent className="p-6 text-center">
              <Users className="w-12 h-12 text-white mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Group Conversations
              </h3>
              <p className="text-white/80">
                Create group chats and collaborate with multiple people at once.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur border-white/20">
            <CardContent className="p-6 text-center">
              <Zap className="w-12 h-12 text-white mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Lightning Fast
              </h3>
              <p className="text-white/80">
                Experience blazing fast performance with our optimized chat platform.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
