"use client";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";
import React, { useEffect, useState } from "react";

const UserGreetText = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };
    fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (user !== null) {
    console.log(user);
    return (
      <>
        <p className="font-mono font-bold">
          {user.user_metadata.full_name ?? "user"}!
        </p>
        <div className="relative rounded-full overflow-hidden w-10 h-10">
          <Image src={user.user_metadata.avatar_url} alt="avatar" fill />
        </div>
      </>
    );
  }
  return (
    <p >
    Login to start creating .. 
    </p>
  );
};

export default UserGreetText;
